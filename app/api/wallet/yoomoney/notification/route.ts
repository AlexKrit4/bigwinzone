import { DepositStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPromoOnDeposit } from "@/lib/promo";
import { creditUserBalance } from "@/lib/wallet";
import { verifyYooMoneyNotification } from "@/lib/yoomoney";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const params = {
    notification_type: String(form.get("notification_type") ?? ""),
    operation_id: String(form.get("operation_id") ?? ""),
    amount: String(form.get("amount") ?? ""),
    currency: String(form.get("currency") ?? ""),
    datetime: String(form.get("datetime") ?? ""),
    sender: String(form.get("sender") ?? ""),
    codepro: String(form.get("codepro") ?? "false"),
    label: String(form.get("label") ?? ""),
    sha1_hash: String(form.get("sha1_hash") ?? ""),
  };

  if (!verifyYooMoneyNotification(params)) {
    console.warn("[yoomoney] invalid sha1_hash", params.label);
    return new NextResponse("Invalid hash", { status: 403 });
  }

  const paidAmount = Number.parseFloat(params.amount);
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return new NextResponse("Invalid amount", { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.findUnique({
        where: { label: params.label },
      });

      if (!deposit) {
        throw new Error("DEPOSIT_NOT_FOUND");
      }

      if (deposit.status === DepositStatus.COMPLETED) {
        return;
      }

      if (deposit.externalId === params.operation_id) {
        return;
      }

      const existingOp = await tx.deposit.findUnique({
        where: { externalId: params.operation_id },
      });
      if (existingOp) return;

      if (Math.abs(paidAmount - deposit.amount) > 0.01) {
        console.warn(
          `[yoomoney] amount mismatch label=${params.label} expected=${deposit.amount} got=${paidAmount}`,
        );
      }

      await creditUserBalance(
        tx,
        deposit.userId,
        paidAmount,
        "DEPOSIT",
        deposit.id,
        `ЮMoney ${params.operation_id}`,
      );

      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.COMPLETED,
          externalId: params.operation_id,
          completedAt: new Date(),
          amount: paidAmount,
        },
      });

      await applyPromoOnDeposit(tx, deposit.id, deposit.userId, paidAmount);
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DEPOSIT_NOT_FOUND") {
      return new NextResponse("Unknown label", { status: 404 });
    }
    console.error("[yoomoney] notification error", err);
    return new NextResponse("Error", { status: 500 });
  }

  return new NextResponse("OK");
}
