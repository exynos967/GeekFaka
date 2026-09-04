import type { Prisma } from "@prisma/client";

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
