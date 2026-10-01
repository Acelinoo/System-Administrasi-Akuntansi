import { prisma } from '../src/lib/db/prisma';

async function main() {
  const batches = await prisma.submissionBatch.count();
  const items = await prisma.accExpenseItem.count();
  const disbursements = await prisma.disbursement.count();
  const journals = await prisma.journalEntry.count();
  const inflows = await prisma.fundInflow.count();
  
  const projects = await prisma.project.findMany({ 
    select: { id: true, code: true, name: true, subUnits: { select: { id: true, code: true, name: true } } } 
  });
  const categories = await prisma.expenseCategory.findMany({ 
    select: { id: true, code: true, name: true, subCategories: { select: { id: true, code: true, name: true } } } 
  });
  const pics = await prisma.fieldPic.findMany({ select: { id: true, name: true, roleTitle: true } });
  const accounts = await prisma.cashAccount.findMany({ 
    select: { id: true, accountCode: true, accountName: true, accountType: true } 
  });
  const coa = await prisma.coaAccount.findMany({ select: { id: true, accountCode: true, accountName: true } });
  
  console.log("DATABASE COUNTS & PROJECTS:");
  console.log(JSON.stringify({
    counts: { batches, items, disbursements, journals, inflows },
    projects
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
