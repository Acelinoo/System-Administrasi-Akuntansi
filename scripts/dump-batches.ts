import { prisma } from "../src/lib/db/prisma";
import fs from "fs";

async function main() {
  const allBatches = await prisma.submissionBatch.findMany({
    include: {
      items: {
        include: {
          disbursementItems: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total Batches: ${allBatches.length}`);
  const totalItems = allBatches.reduce((s, b) => s + b.items.length, 0);
  console.log(`Total Items: ${totalItems}`);

  const batchReport = allBatches.map(b => {
    const totalApproved = b.items.reduce((s, i) => s + Number(i.approvedAmount), 0);
    const totalRealized = b.items.reduce((s, i) => s + i.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0), 0);
    return {
      id: b.id,
      batchCode: b.batchCode,
      noKas: b.noKas,
      accDate: b.accDate,
      approvedByName: b.approvedByName,
      notes: b.notes,
      createdAt: b.createdAt,
      itemCount: b.items.length,
      totalApproved,
      totalRealized,
      sampleItemNotes: b.items[0]?.notes || null
    };
  });

  fs.writeFileSync("all-batches-dump.json", JSON.stringify(batchReport, null, 2));
  console.log("Wrote all-batches-dump.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
