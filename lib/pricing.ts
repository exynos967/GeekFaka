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
