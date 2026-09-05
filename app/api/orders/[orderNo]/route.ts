import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentAdapter } from "@/lib/payments/registry";

export async function GET(
  req: Request,
  { params }: { params: { orderNo: string } }
) {
  const { orderNo } = params;
  const contact = req.headers.get("X-Order-Contact");

  if (!contact?.trim()) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        product: {
          select: { name: true, description: true, deliveryFormat: true }
        },
        licenses: {
          select: { id: true, code: true }
        }
      }
    });

    if (!order || typeof order.email !== "string" ||
        order.email.trim().toLowerCase() !== contact.trim().toLowerCase()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Security: Only expose license codes if order is PAID
    if (order.status !== "PAID") {
      // Create a sanitized order object without licenses
      const { licenses, ...safeOrder } = order;
      return NextResponse.json({ ...safeOrder, licenses: [] });
    }

    return NextResponse.json(order);
  } catch {
    console.error("Fetch order error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { orderNo: string } }) {
  const contact = req.headers.get("X-Order-Contact")?.trim();
  if (!contact) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  try {
    const { channel } = await req.json();
    if (channel !== undefined && typeof channel !== "string") {
      return NextResponse.json({ error: "支付方式不合法" }, { status: 400 });
    }
    const order = await prisma.order.findUnique({
      where: { orderNo: params.orderNo },
      include: { product: { select: { name: true } } }
    });
    if (!order?.email || order.email.trim().toLowerCase() !== contact.toLowerCase()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const reserved = !!order.couponId && ["PENDING", "EXPIRED"].includes(order.status);
    if (!reserved && (order.status !== "PENDING" ||
        order.createdAt.getTime() + 30 * 60 * 1000 < Date.now())) {
      return NextResponse.json({ error: "订单已支付或无法继续支付，请刷新订单" }, { status: 409 });
    }
    const intent = await getPaymentAdapter(order.paymentMethod || "epay").createPayment(
      order.orderNo, Number(order.totalAmount), `${order.product.name} x${order.quantity}`, { channel }
    );
    if (reserved && order.status === "EXPIRED") {
      await prisma.order.updateMany({
        where: { id: order.id, status: "EXPIRED", couponId: { not: null } },
        data: { status: "PENDING" }
      });
    }
    return NextResponse.json({ success: true, payUrl: intent.payUrl });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
    }
    console.error("Resume payment failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "暂时无法继续支付，请稍后重试或联系客服" }, { status: 503 });
  }
}
