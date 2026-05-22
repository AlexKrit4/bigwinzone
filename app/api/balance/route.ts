import { NextResponse } from "next/server";
import { balancesResponse, getUserBalances } from "@/lib/balances";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balances = await prisma.$transaction((tx) => getUserBalances(tx, userId));

  return NextResponse.json(balancesResponse(balances));
}
