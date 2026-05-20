import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const bet = Number(body?.bet ?? 0);
  const win = Number(body?.win ?? 0);

  if (!Number.isFinite(bet) || bet < 0) {
    return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
  }

  if (!Number.isFinite(win) || win < 0) {
    return NextResponse.json({ error: "Invalid win" }, { status: 400 });
  }

  if (bet === 0 && win === 0) {
    return NextResponse.json({ error: "Empty spin settlement" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      if (Number(user.balance) < bet) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: win - bet,
          },
        },
        select: { balance: true },
      });
    });

    return NextResponse.json({ balance: Number(updated.balance) });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json({ error: "Недостаточно средств" }, { status: 400 });
    }

    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.error("[spin]", err);
    return NextResponse.json({ error: "Spin settlement failed" }, { status: 500 });
  }
}
