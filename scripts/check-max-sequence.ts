import { prisma } from "../src/lib/db/prisma";

async function main() {
  const sequences = await prisma.cashSequence.findMany();
  console.log("Current sequences in DB:", sequences);

  const items = await prisma.accExpenseItem.findMany({ select: { noKas: true } });
  let maxKT = 0;
  let maxKU = 0;
  items.forEach(i => {
    const ktMatch = i.noKas.match(/^KT\.26\.(\d+)/i);
    if (ktMatch) {
      const n = parseInt(ktMatch[1], 10);
      if (n > maxKT) maxKT = n;
    }
    const kuMatch = i.noKas.match(/^KU\.26\.(\d+)/i);
    if (kuMatch) {
      const n = parseInt(kuMatch[1], 10);
      if (n > maxKU) maxKU = n;
    }
  });
  console.log({ maxKT, maxKU });
}

main().catch(console.error).finally(() => prisma.$disconnect());
