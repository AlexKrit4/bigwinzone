import { UserRole } from "@prisma/client";
import { getUserIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const userId = await getUserIdFromCookie();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      balance: true,
      role: true,
    },
  });
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Unauthorized" as const, status: 401 as const, user: null };
  }
  if (user.role !== UserRole.ADMIN) {
    return { error: "Forbidden" as const, status: 403 as const, user: null };
  }
  return { error: null, status: 200 as const, user };
}
