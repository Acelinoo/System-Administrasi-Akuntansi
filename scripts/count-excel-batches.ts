import { prisma } from "../src/lib/db/prisma";

async function main() {
  const batches = await prisma.submissionBatch.findMany({
    include: {
      items: true
    }
  });

  const excelBatches = batches.filter(b => b.notes?.startsWith("Impor Real Excel") || b.batchCode.startsWith("BATCH-KU-") || b.batchCode.startsWith("BATCH-KT-"));
  const nonExcelBatches = batches.filter(b => !excelBatches.includes(b));

  console.log(`Excel Batches: ${excelBatches.length}, Items: ${excelBatches.reduce((s, b) => s + b.items.length, 0)}`);
  console.log(`Non-Excel Batches: ${nonExcelBatches.length}, Items: ${nonExcelBatches.reduce((s, b) => s + b.items.length, 0)}`);

  // Let's check nonExcelBatches codes
  console.log("Non-Excel batch codes:");
  nonExcelBatches.forEach(b => console.log(`- ${b.batchCode} (${b.items.length} items)`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
