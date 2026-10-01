import { prisma } from '../src/lib/db/prisma';

async function main() {
  const batches = await prisma.submissionBatch.findMany({
    select: {
      id: true,
      batchCode: true,
      noKas: true,
      accDate: true,
      items: {
        select: {
          id: true,
          itemNo: true,
          noKas: true,
          description: true,
          approvedAmount: true,
          status: true,
          disbursementItems: {
            select: {
              realizedAmount: true
            }
          }
        }
      }
    }
  });

  console.log(`Found ${batches.length} existing batches in DB.`);
  batches.forEach(b => {
    console.log(`- Batch ${b.batchCode} | No Kas: ${b.noKas || '(none)'} | Date: ${b.accDate.toISOString().slice(0, 10)} | Items: ${b.items.length}`);
    b.items.forEach(i => {
      const realized = i.disbursementItems.reduce((acc, d) => acc + Number(d.realizedAmount), 0);
      console.log(`    #${i.itemNo} ${i.noKas}: ${i.description} (Approved: ${i.approvedAmount}, Realized: ${realized}, Status: ${i.status})`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
