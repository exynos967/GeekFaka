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

    if (action === "MARK_PAID") {
       await prisma.$transaction(async (tx) => {
         await fulfillOrder(tx, order.id, "manual");
       });

       sendOrderEmail(order.orderNo).catch(console.error);

       return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    if (error instanceof OrderStateConflictError || error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 500 });
  }
}
