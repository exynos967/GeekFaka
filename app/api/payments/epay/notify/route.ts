import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillOrder } from "@/lib/fulfillment";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";
import { sendOrderEmail } from "@/lib/mail";

export async function GET(req: Request) {
  // EPay notifications are usually GET requests, but verify based on your gateway
  const { searchParams } = new URL(req.url);
  const data = Object.fromEntries(searchParams.entries());

  return processNotification(data, req);
}

export async function POST(req: Request) {
  // Handle POST notifications if configured
  const formData = await req.formData();
  const data = Object.fromEntries(formData.entries());
  
  return processNotification(data, req);
}

async function processNotification(data: any, req?: Request) {
  const log = logger.child({ module: 'EPayNotify', orderNo: data.out_trade_no });
  log.info("Received payment callback");

  try {
    const adapter = getPaymentAdapter("epay");
    // Pass headers if available, or empty object
    const headers = req ? Object.fromEntries(req.headers.entries()) : {};
    const callbackData = await adapter.verifyCallback(data, headers);
    
    log.info("Signature verified");

    if (callbackData.status === "PAID") {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { orderNo: callbackData.orderNo },
          select: { id: true }
        });

        if (!order) {
            log.error("Order not found");
            throw new Error("Order not found");
        }

        await fulfillOrder(tx, order.id, "epay", callbackData.amount);
      });

      sendOrderEmail(callbackData.orderNo).catch(error =>
        log.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Email background task failed")
      );

      return new NextResponse("success");
    }

    return new NextResponse("fail", { status: 400 });
  } catch (error) {
    log.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Payment notification processing failed");
    return new NextResponse("fail", { status: 400 });
  }
}
