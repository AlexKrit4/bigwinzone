import { NextResponse } from "next/server";
import { completeDepositPayment } from "@/lib/complete-deposit";
import { prisma } from "@/lib/prisma";
import { verifyYooMoneyNotification } from "@/lib/yoomoney";

function formToRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    out[key] = String(value);
  }
  return out;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const allParams = formToRecord(form);

  if (allParams.test_notification === "true") {
    if (!verifyYooMoneyNotification(allParams)) {
      return new NextResponse("Invalid hash", { status: 403 });
    }
    return new NextResponse("OK");
  }

  if (!verifyYooMoneyNotification(allParams)) {
    console.warn(
      "[yoomoney] invalid signature",
      allParams.label,
      allParams.sign ? "sign" : "sha1",
    );
    return new NextResponse("Invalid hash", { status: 403 });
  }

  const paidAmount = Number.parseFloat(allParams.amount ?? "");
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return new NextResponse("Invalid amount", { status: 400 });
  }

  const label = allParams.label ?? "";
  const operationId = allParams.operation_id ?? "";
  if (!label || !operationId) {
    return new NextResponse("Missing fields", { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.findUnique({
        where: { label },
      });

      if (!deposit) {
        throw new Error("DEPOSIT_NOT_FOUND");
      }

      return completeDepositPayment(
        tx,
        deposit,
        paidAmount,
        operationId,
        `ЮMoney ${operationId}`,
      );
    });

    if (result === "duplicate") {
      return new NextResponse("OK");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "DEPOSIT_NOT_FOUND") {
      return new NextResponse("Unknown label", { status: 404 });
    }
    console.error("[yoomoney] notification error", err);
    return new NextResponse("Error", { status: 500 });
  }

  return new NextResponse("OK");
}
