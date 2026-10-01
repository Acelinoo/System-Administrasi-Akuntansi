import { prisma } from "../src/lib/db/prisma";

async function main() {
  const postedDisbursements = await prisma.disbursement.findMany({
    where: { status: "POSTED" },
    include: {
      items: {
        include: {
          accItem: {
            include: {
              batch: true
            }
          }
        }
      }
    }
  });

  console.log(`Total POSTED Disbursements: ${postedDisbursements.length}`);

  let totalRealized = 0;
  postedDisbursements.forEach((d, idx) => {
    const amt = Number(d.totalRealizedAmount);
    totalRealized += amt;
    const batchCodes = Array.from(new Set(d.items.map(i => i.accItem.batch.batchCode))).join(", ");
    const noKasList = Array.from(new Set(d.items.map(i => i.accItem.noKas))).join(", ");
    const isExcel = d.items.some(i => i.accItem.notes?.startsWith("Sumber Excel:"));
    console.log(
      `[${idx + 1}] ${d.disbursementNumber} | Rp ${amt.toLocaleString("id-ID")} | Batch: ${batchCodes} | NoKas: ${noKasList} | Source: ${isExcel ? 'REAL_EXCEL' : 'PRE_EXISTING/TEST'}`
    );
  });

  console.log(`Total: Rp ${totalRealized.toLocaleString("id-ID")}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
