import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

// Update Category
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { name, slug, priority, isVisible } = await req.json();
    const { id } = params;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(priority !== undefined ? { priority: Number(priority) } : {}),
        ...(isVisible !== undefined ? { isVisible: Boolean(isVisible) } : {}),
      }
    });

    return NextResponse.json(category);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// Delete Category
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { id } = params;
    
    await prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { id } });
      const productCount = await tx.product.count({ where: { categoryId: id } });
      const couponCount = await tx.coupon.count({ where: { categoryId: id } });
      if (productCount > 0 || couponCount > 0) {
        throw new RangeError("该分类仍有关联商品或优惠券，请先处理关联记录。");
      }
      await tx.category.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
