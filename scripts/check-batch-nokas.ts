import { prisma } from "../src/lib/db/prisma";

async function main() {
  const batches = await prisma.submissionBatch.findMany({
    select: { id: true, batchCode: true, noKas: true, notes: true }
  });

  const withNoKas = batches.filter(b => b.noKas !== null);
  const withoutNoKas = batches.filter(b => b.noKas === null);

  console.log(`Total Batches: ${batches.length}`);
  console.log(`With No Kas: ${withNoKas.length}`);
  console.log(`Without No Kas: ${withoutNoKas.length}`);

  const uniqueBatchNoKas = new Set(withNoKas.map(b => b.noKas!.toUpperCase()));
  console.log(`Unique No Kas in batches: ${uniqueBatchNoKas.size}`);

  // What about items?
  const items = await prisma.accExpenseItem.findMany({ select: { noKas: true } });
  const uniqueItemNoKas = new Set(items.map(i => i.noKas.toUpperCase()));
  console.log(`Unique No Kas in items: ${uniqueItemNoKas.size}`);

  // In Phase 8C report: 376 imported + 15 collision = 391, + 1 = 392
  // Why is uniqueBatchNoKas 387? (392 - 387 = 5)
  // Let's check which batches share No Kas or if 5 batches in Phase 8B test had something:
  console.log("Batches without No Kas:", withoutNoKas.map(b => b.batchCode));

  const countByNoKas = new Map<string, number>();
  withNoKas.forEach(b => {
    const k = b.noKas!.toUpperCase();
    countByNoKas.set(k, (countByNoKas.get(k) || 0) + 1);
  });
  const dups = Array.from(countByNoKas.entries()).filter(([_, c]) => c > 1);
  console.log(`Duplicate No Kas across batches:`, dups);
}

main().catch(console.error).finally(() => prisma.$disconnect());
