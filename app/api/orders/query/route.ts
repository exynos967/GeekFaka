import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请输入订单号和下单联系方式" }, { status: 400 });
  }
  const { orderNo, contact } = body ?? {};

  if (typeof orderNo !== "string" || !orderNo.trim() ||
      typeof contact !== "string" || !contact.trim()) {
    return NextResponse.json({ error: "请输入订单号和下单联系方式" }, { status: 400 });
  }

  try {
    const orderByNo = await prisma.order.findUnique({
      where: { orderNo: orderNo.trim() },
      select: {
        orderNo: true,
        email: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        product: { select: { name: true } }
      }
    });

    if (!orderByNo || typeof orderByNo.email !== "string" ||
        orderByNo.email.trim().toLowerCase() !== contact.trim().toLowerCase()) {
      return NextResponse.json([]);
    }

    return NextResponse.json([{
      orderNo: orderByNo.orderNo,
      status: orderByNo.status,
      totalAmount: orderByNo.totalAmount,
      createdAt: orderByNo.createdAt,
      product: orderByNo.product
    }]);
  } catch {
    console.error("Order query error");
    return NextResponse.json({ error: "系统错误" }, { status: 500 });
  }
}
