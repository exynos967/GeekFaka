import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { validateDiscount } from "@/lib/pricing";
import { OrderStateConflictError } from "@/lib/fulfillment";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { code, discountValue, discountType, productId, categoryId, isUsed } = await req.json();
    const { id } = params;

    if ((code !== undefined && (typeof code !== "string" || !code.trim())) ||
        (isUsed !== undefined && typeof isUsed !== "boolean")) {
      return NextResponse.json({ error: "优惠码内容或状态不合法" }, { status: 400 });
    }
    const coupon = await prisma.$transaction(async (tx) => {
      // Lock the coupon before reading reservations created by another request.
      const current = await tx.coupon.update({
        where: { id }, data: { id }, include: { order: true }
      });
      if (current.order) throw new OrderStateConflictError("优惠码已关联订单，不能编辑");
      const discount = validateDiscount(
        discountType ?? current.discountType,
        discountValue === undefined ? Number(current.discountValue) : discountValue
      );
      return tx.coupon.update({
        where: { id },
        data: {
          code: code?.trim().toUpperCase(),
          ...discount,
          productId,
          categoryId,
          isUsed
        }
      });
    });

    return NextResponse.json(coupon);
  } catch (error) {
    if (error instanceof OrderStateConflictError || error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof RangeError ? 400 : 409 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.coupon.update({
        where: { id: params.id }, data: { id: params.id }, include: { order: true }
      });
      if (current.order) throw new OrderStateConflictError("优惠码已关联订单，不能删除");
      await tx.coupon.delete({ where: { id: params.id } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof OrderStateConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
