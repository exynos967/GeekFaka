export interface Discount {
  discountType: string;
  discountValue: number;
}

export function validateDiscount(discountType: unknown, discountValue: unknown): Discount {
  const value = typeof discountValue === "number" ||
    (typeof discountValue === "string" && discountValue.trim() !== "")
    ? Number(discountValue) : NaN;
  if ((discountType !== "FIXED" && discountType !== "PERCENTAGE") ||
      !Number.isFinite(value) || value < 0 ||
      (discountType === "PERCENTAGE" && value > 100)) {
    throw new RangeError("优惠金额须为非负数，百分比须在 0 到 100 之间");
  }
  return { discountType, discountValue: value };
}

export function calculatePrice(
  price: number,
  quantity: number,
  discount: Discount | null = null,
  feePercent = 0
) {
  if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(quantity) || quantity < 1 ||
      !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
    throw new RangeError("商品价格、购买数量或手续费率不合法");
  }
  const subtotalCents = Math.round(price * 100) * quantity;
  const validDiscount = discount && validateDiscount(discount.discountType, discount.discountValue);
  const discountCents = validDiscount
    ? Math.min(subtotalCents, Math.round(validDiscount.discountType === "PERCENTAGE"
      ? subtotalCents * validDiscount.discountValue / 100
      : validDiscount.discountValue * 100))
    : 0;
  const productCents = subtotalCents - discountCents;
  const feeCents = Math.round(productCents * feePercent / 100);
  const totalCents = productCents + feeCents;
  if (![subtotalCents, discountCents, totalCents].every(Number.isSafeInteger)) {
    throw new RangeError("订单金额超出允许范围");
  }
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    productTotal: productCents / 100,
    feeAmount: feeCents / 100,
    totalAmount: totalCents / 100
  };
}
