import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillOrder, InsufficientStockError, OrderStateConflictError } from "@/lib/fulfillment";
import { isAuthenticated } from "@/lib/auth";
import { sendOrderEmail } from "@/lib/mail";

// Manual Actions (e.g., Mark as Paid)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { action } = await req.json(); // "MARK_PAID"
    const { id } = params;

    const order = await prisma.order.findUnique({ 
      where: { id },
      include: { product: true }
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (action === "RETRY_EMAIL") {
      if (order.status !== "PAID") {
        return NextResponse.json({ error: "仅已支付订单可补发邮件" }, { status: 400 });
      }
      const email = await sendOrderEmail(order.orderNo);
      if (email.status === "failed" || email.status === "skipped") {
        return NextResponse.json({ error: email.message }, { status: 502 });
      }
      return NextResponse.json({ success: true, emailStatus: email.status });
    }

    if (action === "MARK_PAID") {
       await prisma.$transaction(async (tx) => {
         await fulfillOrder(tx, order.id, "manual");
       });

       const email = await sendOrderEmail(order.orderNo);

       return NextResponse.json({ success: true, emailStatus: email.status, emailMessage: email.message });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    if (error instanceof OrderStateConflictError || error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 500 });
  }
}
