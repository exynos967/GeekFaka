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

    const orderCount = await prisma.order.count({
      where: { productId: id }
    });

    if (orderCount > 0) {
      return NextResponse.json({ error: "该商品已有订单记录，无法直接删除，请改为下架以保留订单和卡密记录。" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.license.deleteMany({
        where: { productId: id }
      }),
      prisma.coupon.updateMany({
        where: { productId: id },
        data: { productId: null }
      }),
      prisma.product.delete({
        where: { id }
      })
    ]);
    
    log.info({ productId: id }, "Product deleted");
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error, productId: params.id }, "Failed to delete product");
    return NextResponse.json({ error: "删除商品失败" }, { status: 500 });
  }
}
