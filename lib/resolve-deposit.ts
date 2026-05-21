import { DepositStatus, type Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

const PENDING_WINDOW_MS = 3 * 60 * 60 * 1000;
const MAX_COMMISSION_RATIO = 0.05;

/** Найти PENDING-депозит по метке или по сумме (если label в уведомлении пустой). */
export async function findDepositForNotification(
  tx: Tx,
  label: string,
  walletAmount: number,
  withdrawAmount?: number,
) {
  const trimmedLabel = label.trim();
  if (trimmedLabel) {
    const byLabel = await tx.deposit.findUnique({ where: { label: trimmedLabel } });
    if (byLabel) return byLabel;
  }

  const since = new Date(Date.now() - PENDING_WINDOW_MS);
  const paidAmount =
    withdrawAmount != null && Number.isFinite(withdrawAmount)
      ? withdrawAmount
      : null;

  if (paidAmount != null) {
    const exact = await tx.deposit.findMany({
      where: {
        status: DepositStatus.PENDING,
        createdAt: { gte: since },
        amount: { gte: paidAmount - 0.01, lte: paidAmount + 0.01 },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (exact.length === 1) {
      console.log(
        "[yoomoney] matched by paid amount",
        paidAmount,
        "label=",
        exact[0].label,
      );
      return exact[0];
    }
    if (exact.length > 1) {
      console.error(
        "[yoomoney] ambiguous deposit for paid amount",
        paidAmount,
        exact.map((d) => d.label).join(", "),
      );
      return null;
    }
  }

  const pending = await tx.deposit.findMany({
    where: { status: DepositStatus.PENDING, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const byNet = pending.filter((d) => {
    const expected = Number(d.amount);
    const minNet = expected * (1 - MAX_COMMISSION_RATIO) - 0.01;
    return walletAmount + 0.01 >= minNet && walletAmount <= expected + 0.01;
  });

  if (byNet.length === 1) {
    console.log(
      "[yoomoney] matched by wallet net",
      walletAmount,
      "label=",
      byNet[0].label,
      "expected=",
      byNet[0].amount,
    );
    return byNet[0];
  }

  if (byNet.length > 1) {
    console.error(
      "[yoomoney] ambiguous deposit for wallet net",
      walletAmount,
      byNet.map((d) => d.label).join(", "),
    );
  }

  return null;
}
