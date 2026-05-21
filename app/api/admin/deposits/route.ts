import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const deposits = await prisma.deposit.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { username: true, email: true } },
    },
  });

  return NextResponse.json({
    deposits: deposits.map((d) => ({
      id: d.id,
      username: d.user.username,
      email: d.user.email,
      amount: Number(d.amount),
      status: d.status,
      provider: d.provider,
      label: d.label,
      externalId: d.externalId,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    })),
  });
}
