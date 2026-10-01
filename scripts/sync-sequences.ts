import { prisma } from "../src/lib/db/prisma";

async function main() {
  console.log("Synchronizing cash sequences to max imported numbers...");

  await prisma.cashSequence.upsert({
    where: { prefix_year: { prefix: "KT", year: 2026 } },
    update: { lastNumber: 750 },
    create: { prefix: "KT", year: 2026, lastNumber: 750 }
  });

  await prisma.cashSequence.upsert({
    where: { prefix_year: { prefix: "KU", year: 2026 } },
    update: { lastNumber: 990 },
    create: { prefix: "KU", year: 2026, lastNumber: 990 }
  });

  console.log("Sequences synchronized successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
