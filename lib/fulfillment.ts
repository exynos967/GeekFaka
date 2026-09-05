import type { Prisma } from "@prisma/client";

export class OrderStateConflictError extends Error {
  constructor(message = "订单状态已变化，请刷新后重试") {
    super(message);
    this.name = "OrderStateConflictError";
  }
}

export async function fulfillOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentMethod: string,
  expectedAmount?: string
) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderStateConflictError();
  if (expectedAmount !== undefined && order.totalAmount.toFixed(2) !== expectedAmount) {
    throw new Error("Amount mismatch");
  }
  if (order.status === "PAID") return false;
  if (order.status !== "PENDING" && order.status !== "EXPIRED") {
    throw new OrderStateConflictError();
  }

  // Claim the order before touching stock; any later failure rolls this back.
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: { in: ["PENDING", "EXPIRED"] } },
    data: { status: "PAID", paymentMethod, paidAt: new Date() }
  });
  if (claimed.count !== 1) throw new OrderStateConflictError();
  await claimAvailableLicenses(tx, {
    productId: order.productId,
    orderId: order.id,
    quantity: order.quantity
  });
  if (order.couponId) {
    await tx.coupon.update({
      where: { id: order.couponId },
      data: { isUsed: true, usedAt: new Date() }
    });
  }
  return true;
}

export class InsufficientStockError extends Error {
  constructor() {
    super("Insufficient stock");
    this.name = "InsufficientStockError";
  }
}

export class LicenseClaimConflictError extends Error {
  constructor() {
    super("License claim conflict");
    this.name = "LicenseClaimConflictError";
  }
}

export async function claimAvailableLicenses(
  tx: Prisma.TransactionClient,
  { productId, orderId, quantity }: { productId: string; orderId: string; quantity: number }
) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError("Quantity must be a positive integer");
  }

  const licenses = await tx.license.findMany({
    where: { productId, status: "AVAILABLE", orderId: null },
    orderBy: { createdAt: "asc" },
    take: quantity,
    select: { id: true }
  });

  if (licenses.length < quantity) {
    throw new InsufficientStockError();
  }

  const result = await tx.license.updateMany({
    where: {
      id: { in: licenses.map((license) => license.id) },
      status: "AVAILABLE",
      orderId: null
    },
    data: { status: "SOLD", orderId }
  });

  if (result.count !== quantity) {
    throw new LicenseClaimConflictError();
  }
}
