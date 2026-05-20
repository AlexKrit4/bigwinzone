import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signUserToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !username || password.length < 6) {
      return NextResponse.json(
        { error: "Введите email, ник и пароль минимум 6 символов" },
        { status: 400 },
      );
    }

    const exists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json(
        { error: "Пользователь с таким email или ником уже существует" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, balance: true },
    });

    await setAuthCookie(signUserToken(user.id));

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        balance: Number(user.balance),
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера (возможно, база данных не запущена)" },
      { status: 500 }
    );
  }
}
