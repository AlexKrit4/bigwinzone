const { PrismaClient } = require('@prisma/client');

const AMOUNT = 10000;

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      balance: true,
      balanceCash: true,
    },
  });
  console.log('Before:', users);

  await prisma.user.updateMany({
    data: {
      balanceCash: AMOUNT,
      balanceBonus: 0,
      balancePromoDeposit: 0,
      balance: AMOUNT,
    },
  });

  const after = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      balance: true,
      balanceCash: true,
    },
  });
  console.log('After:', after);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
