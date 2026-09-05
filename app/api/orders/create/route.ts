import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillOrder, InsufficientStockError, OrderStateConflictError } from "@/lib/fulfillment";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";
import { sendOrderEmail } from "@/lib/mail";
import { calculatePrice, validateDiscount, type Discount } from "@/lib/pricing";
import type { Prisma } from "@prisma/client";
import type { PaymentIntent } from "@/lib/payments/types";

const log = logger.child({ module: 'OrderCreate' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, quantity = 1, email, paymentMethod = "epay", couponCode, options } = body;
    const orderQuantity = Number(quantity);

    log.info({ productId, quantity, paymentMethod }, "Order creation attempt");

    if (typeof productId !== "string" || !productId ||
        typeof email !== "string" || !email.trim() || email.length > 320 ||
        typeof paymentMethod !== "string" ||
        (couponCode !== undefined && typeof couponCode !== "string") ||
        (options !== undefined && (typeof options !== "object" || options === null ||
          (options.channel !== undefined && typeof options.channel !== "string")))) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!Number.isSafeInteger(orderQuantity) || orderQuantity < 1) {
      return NextResponse.json({ error: "购买数量不合法" }, { status: 400 });
    }

    // 1. Check Product & Stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        _count: {
          select: { licenses: { where: { status: "AVAILABLE", orderId: null } } }
        }
      }
    });

    if (!product) {
      log.warn({ productId }, "Product not found");
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. Handle Coupon
    let discount: Discount | null = null;
    let couponSnapshot: Prisma.CouponWhereInput = {};
    let validCouponId: string | undefined = undefined;
    const price = Number(product.price);

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "商品价格不合法" }, { status: 400 });
    }

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() },
        include: { order: true }
      });

      if (coupon?.order) {
        const reserved = coupon.order;
        if (["PENDING", "EXPIRED"].includes(reserved.status) &&
            reserved.email?.trim().toLowerCase() === email.trim().toLowerCase() &&
            reserved.productId === productId && reserved.quantity === orderQuantity) {
          return NextResponse.json({
            success: true,
            orderNo: reserved.orderNo,
            payUrl: `/orders/${reserved.orderNo}`,
            resumed: true
          });
        }
        return NextResponse.json({ error: "优惠码已关联其他订单，请通过原订单继续支付" }, { status: 409 });
      }

      if (!coupon || coupon.isUsed) {
        return NextResponse.json({ error: "优惠码无效或已被使用" }, { status: 400 });
      }

      // Check product binding
      if (coupon.productId && coupon.productId !== productId) {
        return NextResponse.json({ error: "该优惠码不适用于此商品" }, { status: 400 });
      }

      if (coupon.categoryId && coupon.categoryId !== product.categoryId) {
        return NextResponse.json({ error: "该优惠码不适用于此分类下的商品" }, { status: 400 });
      }
      
      discount = validateDiscount(coupon.discountType, Number(coupon.discountValue));
      couponSnapshot = {
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        productId: coupon.productId,
        categoryId: coupon.categoryId
      };
      
      validCouponId = coupon.id;
    }

    // 3. Calculate Amount
    if (!product.isActive) {
      return NextResponse.json({ error: "商品已下架，无法创建新订单" }, { status: 400 });
    }
    if (product._count.licenses < orderQuantity) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    }
    const feeSetting = paymentMethod === "epay"
      ? await prisma.systemSetting.findUnique({ where: { key: "epay_fee" } })
      : null;
    const { totalAmount } = calculatePrice(price, orderQuantity, discount, Number(feeSetting?.value || 0));
    if (totalAmount > 0 && paymentMethod === "coupon") {
      return NextResponse.json({ error: "优惠码抵扣后应付金额需为 0 元" }, { status: 400 });
    }
    if (totalAmount > 0) {
      try {
        getPaymentAdapter(paymentMethod);
      } catch {
        return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 });
      }
    }

    // 4. Create Order
    const orderNo = `HT-${randomUUID()}`;
    let paymentIntent: PaymentIntent | undefined;
    if (totalAmount > 0) {
      try {
        // Prepare payment before reserving a coupon; a failure leaves no reservation behind.
        paymentIntent = await getPaymentAdapter(paymentMethod).createPayment(
          orderNo, totalAmount, `${product.name} x${orderQuantity}`, options
        );
      } catch (error) {
        log.error({ orderNo, errorType: error instanceof Error ? error.name : "UnknownError" }, "Payment initiation failed");
        return NextResponse.json({ error: "支付初始化失败，请稍后重试或联系客服" }, { status: 503 });
      }
    }

    await prisma.$transaction(async (tx) => {
      const activeProduct = await tx.product.updateMany({
        where: { id: product.id, isActive: true, updatedAt: product.updatedAt },
        data: { isActive: true, updatedAt: product.updatedAt }
      });
      if (activeProduct.count !== 1) throw new OrderStateConflictError();
      if (validCouponId) {
        // Hold the coupon row while the unique order relation reserves it.
        const reserved = await tx.coupon.updateMany({
          where: { ...couponSnapshot, id: validCouponId, isUsed: false, order: { is: null } },
          data: { isUsed: false }
        });
        if (reserved.count !== 1) throw new OrderStateConflictError();
      }

      const created = await tx.order.create({
        data: {
          orderNo,
          email: email.trim(),
          productId,
          quantity: orderQuantity,
          totalAmount,
          paymentMethod: totalAmount === 0 ? (validCouponId ? "coupon" : "free") : paymentMethod,
          status: "PENDING",
          couponId: validCouponId
        }
      });
      if (totalAmount === 0) {
        await fulfillOrder(tx, created.id, created.paymentMethod!);
      }
      return created;
    });

    if (totalAmount === 0) {
      await sendOrderEmail(orderNo);
      return NextResponse.json({ success: true, orderNo, payUrl: `/orders/${orderNo}` });
    }
    
    log.info({ orderNo, totalAmount }, "Order created in DB");

    return NextResponse.json({
      success: true, orderNo, payUrl: paymentIntent?.payUrl, qrCode: paymentIntent?.qrCode
    });

  } catch (error) {
    if (error instanceof RangeError || error instanceof InsufficientStockError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof OrderStateConflictError ||
        (typeof error === "object" && error !== null && "code" in error &&
          (error.code === "P2002" || error.code === "P2034"))) {
      return NextResponse.json({ error: "商品或优惠码状态已变化，请查询原订单或重试" }, { status: 409 });
    }
    log.error({ err: error }, "Order create error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
