/**
 * Назначить пользователя админом по нику.
 * Usage: node scripts/set-admin.mjs AlexKrit
 */
import { PrismaClient } from "@prisma/client";

const username = process.argv[2]?.trim();
if (!username) {
  console.error("Usage: node scripts/set-admin.mjs <username>");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });

  console.log(`OK: ${username} is now ADMIN (id=${user.id})`);
} finally {
  await prisma.$disconnect();
}
