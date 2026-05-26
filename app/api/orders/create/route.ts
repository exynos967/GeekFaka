import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";
import { sendOrderEmail } from "@/lib/mail";

const log = logger.child({ module: 'OrderCreate' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, quantity = 1, email, paymentMethod = "epay", couponCode, options } = body;
    const orderQuantity = Number(quantity);

    log.info({ productId, quantity, email, paymentMethod, couponCode }, "Order creation attempt");

    if (!productId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!Number.isInteger(orderQuantity) || orderQuantity < 1) {
      return NextResponse.json({ error: "购买数量不合法" }, { status: 400 });
    }

    // 1. Check Product & Stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        _count: {
          select: { licenses: { where: { status: "AVAILABLE" } } }
        }
      }
    });

    if (!product) {
      log.warn({ productId }, "Product not found");
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product._count.licenses < orderQuantity) {
      log.warn({ productId, requested: orderQuantity, available: product._count.licenses }, "Insufficient stock");
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    }

    // 2. Handle Coupon
    let discountAmount = 0;
    let validCouponId: string | undefined = undefined;
    const price = Number(product.price);

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "商品价格不合法" }, { status: 400 });
    }

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() }
      });

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
      
      const subtotal = price * orderQuantity;
      if (coupon.discountType === "PERCENTAGE") {
        discountAmount = subtotal * (Number(coupon.discountValue) / 100);
      } else {
        discountAmount = Number(coupon.discountValue);
      }
      
      validCouponId = coupon.id;
    }

    // 3. Calculate Amount
    const totalAmount = Math.max(0, Math.round(((price * orderQuantity) - discountAmount) * 100) / 100);

    // 4. Create Order
    // Generate a simple order number
    const orderNo = `HT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (totalAmount === 0) {
      await prisma.$transaction(async (tx) => {
        if (validCouponId) {
          await tx.coupon.update({
            where: { id: validCouponId },
            data: { isUsed: true, usedAt: new Date() }
          });
        }

        const order = await tx.order.create({
          data: {
            orderNo,
            email,
            productId,
            quantity: orderQuantity,
            totalAmount,
            paymentMethod: validCouponId ? "coupon" : "free",
            status: "PAID",
            paidAt: new Date(),
            couponId: validCouponId
          }
        });

        const licenses = await tx.license.findMany({
          where: {
            productId,
            status: "AVAILABLE"
          },
          orderBy: { createdAt: "asc" },
          take: orderQuantity
        });

        if (licenses.length < orderQuantity) {
          throw new Error("Insufficient stock");
        }

        await tx.license.updateMany({
          where: { id: { in: licenses.map((license) => license.id) } },
          data: { status: "SOLD", orderId: order.id }
        });
      });

      log.info({ orderNo, totalAmount }, "Coupon/free order fulfilled");
      sendOrderEmail(orderNo).catch(e => log.error({ err: e, orderNo }, "Email background task failed"));

      return NextResponse.json({
        success: true,
        orderNo,
        payUrl: `/orders/${orderNo}`
      });
    }

    if (paymentMethod === "coupon") {
      return NextResponse.json({ error: "优惠码抵扣后应付金额需为 0 元" }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      if (validCouponId) {
        await tx.coupon.update({
          where: { id: validCouponId },
          data: { isUsed: true, usedAt: new Date() }
        });
      }

      return await tx.order.create({
        data: {
          orderNo,
          email,
          productId,
          quantity: orderQuantity,
          totalAmount,
          paymentMethod,
          status: "PENDING",
          couponId: validCouponId
        }
      });
    });
    
    log.info({ orderNo, totalAmount }, "Order created in DB");

    // 5. Initiate Payment
    try {
      const adapter = getPaymentAdapter(paymentMethod);
      const paymentIntent = await adapter.createPayment(
        orderNo, 
        totalAmount, 
        `${product.name} x${orderQuantity}`,
        options
      );
      
      log.info({ orderNo, payUrl: paymentIntent.payUrl }, "Payment initiated");

      return NextResponse.json({ 
        success: true, 
        orderNo, 
        payUrl: paymentIntent.payUrl,
        qrCode: paymentIntent.qrCode 
      });

    } catch (payError: any) {
      log.error({ err: payError, orderNo }, "Payment initiation failed");
      return NextResponse.json({ error: "Payment initialization failed: " + payError.message }, { status: 500 });
    }

  } catch (error) {
    log.error({ err: error }, "Order create error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
