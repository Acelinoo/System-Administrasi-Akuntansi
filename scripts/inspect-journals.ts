import { prisma } from "../src/lib/db/prisma";

async function main() {
  const journals = await prisma.journalEntry.findMany({
    include: {
      lines: {
        include: {
          coa: true,
          project: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total Journals in DB: ${journals.length}`);

  let totalPostedDebit = 0;
  let totalPostedCredit = 0;
  let totalVoidDebit = 0;
  let totalVoidCredit = 0;

  const postedList: any[] = [];

  journals.forEach((j, idx) => {
    const d = j.lines.reduce((s, l) => s + Number(l.debit), 0);
    const c = j.lines.reduce((s, l) => s + Number(l.credit), 0);
    const isBalanced = Math.abs(d - c) < 0.01;

    if (j.status === "POSTED") {
      totalPostedDebit += d;
      totalPostedCredit += c;
      postedList.push({
        idx: idx + 1,
        number: j.journalNumber,
        sourceType: j.sourceType,
        sourceId: j.sourceId,
        debit: d,
        credit: c,
        status: j.status,
        balanced: isBalanced,
        lines: j.lines.map(l => `${l.coa.accountCode} (${l.coa.accountName}): D ${Number(l.debit).toLocaleString('id-ID')} / C ${Number(l.credit).toLocaleString('id-ID')}`)
      });
    } else {
      totalVoidDebit += d;
      totalVoidCredit += c;
    }
  });

  console.log(`POSTED Journals count: ${postedList.length}`);
  console.log(`POSTED Total Debit: Rp ${totalPostedDebit.toLocaleString("id-ID")}`);
  console.log(`POSTED Total Credit: Rp ${totalPostedCredit.toLocaleString("id-ID")}`);
  console.log(`Delta: Rp ${(totalPostedDebit - totalPostedCredit).toLocaleString("id-ID")}`);
  console.log(`VOID Total Debit: Rp ${totalVoidDebit.toLocaleString("id-ID")}`);

  // Summary by Source Type
  const bySource: Record<string, { count: number; debit: number; credit: number }> = {};
  postedList.forEach(p => {
    if (!bySource[p.sourceType]) bySource[p.sourceType] = { count: 0, debit: 0, credit: 0 };
    bySource[p.sourceType].count++;
    bySource[p.sourceType].debit += p.debit;
    bySource[p.sourceType].credit += p.credit;
  });

  console.log("\nPOSTED Journals Summary by Source Type:");
  console.log(bySource);

  // Check if any journal is linked to ACC directly (without disbursement)
  const nonDisbNonInflow = postedList.filter(p => p.sourceType !== "DISBURSEMENT" && p.sourceType !== "FUND_INFLOW");
  console.log(`Journals from non-Disbursement & non-Inflow: ${nonDisbNonInflow.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
