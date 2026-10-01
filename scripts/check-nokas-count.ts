import { prisma } from "../src/lib/db/prisma";

async function main() {
  const batches = await prisma.submissionBatch.findMany({ select: { noKas: true } });
  const items = await prisma.accExpenseItem.findMany({ select: { noKas: true } });
  const batchNoKas = new Set(batches.filter(b => b.noKas).map(b => b.noKas!.toUpperCase()));
  const itemNoKas = new Set(items.filter(i => i.noKas).map(i => i.noKas.toUpperCase()));
  console.log({
    batchUniqueNoKas: batchNoKas.size,
    itemUniqueNoKas: itemNoKas.size,
    totalBatchesWithNoKas: batches.filter(b => b.noKas).length,
    totalBatches: batches.length
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
