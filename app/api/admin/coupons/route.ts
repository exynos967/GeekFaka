import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { validateDiscount } from "@/lib/pricing";

export async function GET(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const [coupons, total] = await prisma.$transaction([
    prisma.coupon.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { 
        order: { select: { orderNo: true, status: true } },
        product: { select: { name: true } },
        category: { select: { name: true } }
      }
    }),
    prisma.coupon.count()
  ]);

  return NextResponse.json({
    items: coupons,
    total
  });
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { code, discountValue, discountType, productId, categoryId } = await req.json();

    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const discount = validateDiscount(discountType || "FIXED", discountValue);
    const coupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        discountValue: discount.discountValue,
        discountType: discount.discountType,
        productId: productId || null,
        categoryId: categoryId || null,
        isUsed: false
      }
    });

    return NextResponse.json(coupon);
  } catch (error: any) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
