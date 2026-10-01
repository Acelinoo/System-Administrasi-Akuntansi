import { prisma } from "../src/lib/db/prisma";

async function main() {
  const disbursements = await prisma.disbursement.findMany({
    include: {
      items: {
        include: {
          accItem: {
            select: { id: true, noKas: true, description: true, approvedAmount: true }
          }
        }
      },
      cashAccount: true
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total Disbursements in DB: ${disbursements.length}`);

  let sumAll = 0;
  let sumPosted = 0;
  let sumVoid = 0;

  disbursements.forEach((d, idx) => {
    const amt = Number(d.totalRealizedAmount);
    sumAll += amt;
    if (d.status === "POSTED") sumPosted += amt;
    else sumVoid += amt;

    console.log(
      `[${(idx + 1).toString().padStart(2, "0")}] ${d.disbursementNumber.padEnd(25)} | Date: ${d.disbursementDate.toISOString().slice(0, 10)} | Status: ${d.status.padEnd(6)} | Account: ${d.cashAccount.accountCode.padEnd(12)} | Amount: Rp ${amt.toLocaleString("id-ID").padStart(12)} | Notes: ${d.notes || "-"}`
    );
  });

  console.log(`\nTotal All Disbursements: Rp ${sumAll.toLocaleString("id-ID")}`);
  console.log(`Total POSTED Disbursements: Rp ${sumPosted.toLocaleString("id-ID")}`);
  console.log(`Total VOID Disbursements: Rp ${sumVoid.toLocaleString("id-ID")}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
