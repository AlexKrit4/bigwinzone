import { NextResponse } from "next/server";
import { completeDepositPayment } from "@/lib/complete-deposit";
import { prisma } from "@/lib/prisma";
import { findDepositForNotification } from "@/lib/resolve-deposit";
import {
  describeYooMoneyVerification,
  getYooMoneyConfig,
  verifyYooMoneyNotification,
} from "@/lib/yoomoney";

const WEBHOOK_BUILD = "20260520-match-by-amount";

function formToRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    out[key] = String(value);
  }
  return out;
}

/** Проверка, что URL доступен снаружи (curl / кнопка «Протестировать» в ЮMoney). */
export async function GET() {
  const { wallet, secret } = getYooMoneyConfig();
  return NextResponse.json({
    ok: true,
    message: "YooMoney webhook endpoint. Send POST with form body.",
    configured: Boolean(wallet && secret),
    walletSuffix: wallet ? wallet.slice(-4) : null,
    build: WEBHOOK_BUILD,
  });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    console.error("[yoomoney] POST rejected: no form body");
    return new NextResponse("Bad request", { status: 400 });
  }

  const allParams = formToRecord(form);
  const label = allParams.label ?? "";
  const operationId = allParams.operation_id ?? "";

  console.log(
    "[yoomoney] POST",
    WEBHOOK_BUILD,
    `type=${allParams.notification_type}`,
    `label=${label || "(empty)"}`,
    `op=${operationId || "(empty)"}`,
    `amount=${allParams.amount}`,
    `withdraw=${allParams.withdraw_amount ?? ""}`,
    `keys=${Object.keys(allParams).sort().join(",")}`,
    allParams.sign ? "sign=yes" : "sign=no",
    allParams.test_notification === "true" ? "test=yes" : "",
  );

  if (allParams.test_notification === "true") {
    if (!verifyYooMoneyNotification(allParams)) {
      console.error("[yoomoney] test notification: invalid signature");
      return new NextResponse("Invalid hash", { status: 403 });
    }
    console.log("[yoomoney] test notification: OK");
    return new NextResponse("OK");
  }

  if (!verifyYooMoneyNotification(allParams)) {
    const { secret } = getYooMoneyConfig();
    const check = describeYooMoneyVerification(allParams);
    console.error(
      "[yoomoney] invalid signature",
      WEBHOOK_BUILD,
      `label=${label}`,
      `secretLen=${secret?.length ?? 0}`,
      `sign=${check.hasSign ? (check.signOk ? "ok" : "fail") : "none"}`,
      `sha1=${check.hasSha1 ? (check.sha1Ok ? "ok" : "fail") : "none"}`,
    );
    return new NextResponse("Invalid hash", { status: 403 });
  }

  const walletAmount = Number.parseFloat(allParams.amount ?? "");
  const withdrawRaw = allParams.withdraw_amount?.trim();
  const withdrawAmount = withdrawRaw ? Number.parseFloat(withdrawRaw) : undefined;

  if (!Number.isFinite(walletAmount) || walletAmount <= 0) {
    console.error("[yoomoney] invalid amount", allParams.amount);
    return new NextResponse("Invalid amount", { status: 400 });
  }

  if (!operationId) {
    console.error("[yoomoney] missing operation_id");
    return new NextResponse("Missing operation_id", { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deposit = await findDepositForNotification(
        tx,
        label,
        walletAmount,
        Number.isFinite(withdrawAmount) ? withdrawAmount : undefined,
      );

      if (!deposit) {
        throw new Error("DEPOSIT_NOT_FOUND");
      }

      return completeDepositPayment(tx, deposit, {
        walletAmount,
        withdrawAmount: Number.isFinite(withdrawAmount) ? withdrawAmount : undefined,
        operationId,
        ledgerNote: `ЮMoney ${operationId}`,
      });
    });

    console.log("[yoomoney] result", label || "(matched)", operationId, result);

    if (result === "duplicate") {
      return new NextResponse("OK");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "DEPOSIT_NOT_FOUND") {
      console.error("[yoomoney] deposit not found", label, operationId);
      return new NextResponse("Unknown label", { status: 404 });
    }
    if (
      err instanceof Error &&
      (err.message === "UNDERPAID" || err.message === "WITHDRAW_AMOUNT_MISMATCH")
    ) {
      console.error("[yoomoney] payment rejected", label, err.message);
      return new NextResponse("Amount mismatch", { status: 400 });
    }
    console.error("[yoomoney] notification error", err);
    return new NextResponse("Error", { status: 500 });
  }

  return new NextResponse("OK");
}
