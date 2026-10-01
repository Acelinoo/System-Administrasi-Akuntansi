import { prisma } from "../src/lib/db/prisma";

async function fixItemNos() {
  console.log("Fixing itemNo sequences for existing items in DB...");
  const batches = await prisma.submissionBatch.findMany({
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  for (const b of batches) {
    let seq = 1;
    for (const item of b.items) {
      await prisma.$executeRawUnsafe(
        `UPDATE acc_expense_items SET "itemNo" = ${seq} WHERE id = '${item.id}'::uuid`
      );
      seq++;
    }
  }
  console.log("Updated itemNo for all existing items across", batches.length, "batches.");
}

fixItemNos()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
