import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomInt } from "node:crypto";
import { getConfiguredSecret, secretsEqual } from "@/lib/secrets";
import { validateDiscount } from "@/lib/pricing";

export async function POST(req: Request) {
  const apiKey = req.headers.get("X-API-KEY");
  const validApiKey = getConfiguredSecret("COUPON_API_KEY");
  if (!validApiKey) {
    return NextResponse.json({ error: "Coupon API is not configured" }, { status: 503 });
  }

  if (!apiKey || !secretsEqual(apiKey, validApiKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { 
      count = 1, 
      discountValue, 
      discountType = "FIXED", 
      productId = null, 
      categoryId = null, 
      prefix = "", 
      length = 8 
    } = body;

    const discount = validateDiscount(discountType, discountValue);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    if (!Number.isInteger(count) || count < 1 || count > 500 ||
        !Number.isInteger(length) || length < 1 || length > 64 ||
        count > Math.pow(chars.length, length) ||
        typeof prefix !== "string" || prefix.length > 64 || /\s/.test(prefix) ||
        (productId !== null && typeof productId !== "string") ||
        (categoryId !== null && typeof categoryId !== "string")) {
      return NextResponse.json({ error: "Invalid coupon count, length, prefix or scope" }, { status: 400 });
    }

    const generateCode = () => {
      let code = "";
      for (let i = 0; i < length; i++) {
        code += chars.charAt(randomInt(chars.length));
      }
      return prefix ? `${prefix.toUpperCase()}-${code}` : code;
    };

    const couponsData = [];
    const generatedCodes = new Set<string>();

    for (let attempt = 0; couponsData.length < count && attempt < count * 50; attempt++) {
      const code = generateCode();
      if (!generatedCodes.has(code)) {
        generatedCodes.add(code);
        couponsData.push({
          code,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          productId,
          categoryId,
          isUsed: false
        });
      }
    }

    if (couponsData.length !== count) {
      return NextResponse.json({ error: "Unable to generate enough unique codes; increase length" }, { status: 409 });
    }
    const result = await prisma.coupon.createMany({
      data: couponsData,
    });

    return NextResponse.json({ 
      success: true, 
      requested: count, 
      created: result.count,
      message: result.count < count ? "Some duplicates were skipped" : "All coupons created"
    });

  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Coupon code collision; retry with a longer code" }, { status: 409 });
    }
    console.error("Bulk coupon creation error:", error);
    return NextResponse.json({ error: "Failed to create coupons" }, { status: 500 });
  }
}
