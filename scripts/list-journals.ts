import { prisma } from "../src/lib/db/prisma";

async function main() {
  const journals = await prisma.journalEntry.findMany({
    include: {
      lines: true
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total Journals: ${journals.length}`);
  let sumAllDebit = 0;
  let sumAllCredit = 0;

  journals.forEach((j, idx) => {
    const d = j.lines.reduce((s, l) => s + Number(l.debit), 0);
    const c = j.lines.reduce((s, l) => s + Number(l.credit), 0);
    sumAllDebit += d;
    sumAllCredit += c;
    console.log(`[${idx+1}] ${j.journalNumber} | ${j.sourceType} | ${j.status} | Debit: ${d} | Credit: ${c}`);
  });

  console.log(`Sum All Debit: ${sumAllDebit}`);
  console.log(`Sum All Credit: ${sumAllCredit}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
