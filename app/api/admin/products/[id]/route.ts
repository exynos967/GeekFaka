import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { logger } from "@/lib/logger";

const log = logger.child({ module: 'AdminProduct' });

// Update Product
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { name, description, price, categoryId, isActive, deliveryFormat } = await req.json();
    const { id } = params;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price,
        categoryId,
        isActive,
        deliveryFormat
      }
    });
    
    log.info({ productId: id, changes: { name, price, isActive, deliveryFormat } }, "Product updated");
    return NextResponse.json(product);
  } catch (error) {
    log.error({ err: error, productId: params.id }, "Failed to update product");
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// Delete Product
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { id } = params;

    await prisma.$transaction(async (tx) => {
      // Serialize deletion with new purchases and foreign-key references.
      await tx.product.update({ where: { id }, data: { isActive: false } });
      const orderCount = await tx.order.count({ where: { productId: id } });
      const couponCount = await tx.coupon.count({ where: { productId: id } });
      if (orderCount > 0 || couponCount > 0) {
        throw new RangeError("该商品有关联订单或优惠券，请改为下架，或先处理未使用的关联优惠券。");
      }
      await tx.license.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });
    
    log.info({ productId: id }, "Product deleted");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error({ err: error, productId: params.id }, "Failed to delete product");
    return NextResponse.json({ error: "删除商品失败" }, { status: 500 });
  }
}
