import { prisma } from "../src/lib/db/prisma";
import fs from "fs";

async function main() {
  console.log("=== PROJECT, PIC, & DATABASE SAFETY AUDIT ===");

  // 1. Projects Audit
  const projects = await prisma.project.findMany({
    include: {
      subUnits: true,
      accExpenseItems: {
        include: {
          subUnit: true,
          disbursementItems: true
        }
      }
    }
  });

  const projectAudit = projects.map(p => {
    const totalItems = p.accExpenseItems.length;
    const totalApproved = p.accExpenseItems.reduce((s, i) => s + Number(i.approvedAmount), 0);
    const totalRealized = p.accExpenseItems.reduce((s, i) => s + i.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0), 0);
    const sampleDescriptions = Array.from(new Set(p.accExpenseItems.map(i => i.description))).slice(0, 5);
    const subUnitCounts: Record<string, number> = {};
    p.accExpenseItems.forEach(i => {
      const code = i.subUnit?.code || "NO_SUBUNIT";
      subUnitCounts[code] = (subUnitCounts[code] || 0) + 1;
    });

    let mappingRule = "";
    let businessConfirmation = false;

    if (p.code === "SUMEDANG") mappingRule = "Keyword SUMEDANG (+ sub-units SMA, SMP, SD, TK, SIPIL, BAJA)";
    else if (p.code === "ALCENT") mappingRule = "Keyword ALCENT, AL-CENT, atau SMP/SMA/SD/TK umum";
    else if (p.code === "KAWALUYAAN") mappingRule = "Keyword KAWALUYAAN";
    else if (p.code === "RT_BU_ANI") mappingRule = "Keyword RT BU ANI / BU ANI";
    else if (p.code === "TANGGERANG") mappingRule = "Keyword TANGGERANG / TANGERANG";
    else if (p.code === "DARUL_ULUM") { mappingRule = "Keyword DARUL ULUM"; businessConfirmation = true; }
    else if (p.code === "BUDI_INDAH") { mappingRule = "Keyword BUDI INDAH / BD INDAH"; businessConfirmation = true; }
    else if (p.code === "APARTEMEN") { mappingRule = "Keyword APARTEMEN"; businessConfirmation = true; }
    else if (p.code === "ANTAPANI") { mappingRule = "Keyword ANTAPANI"; businessConfirmation = true; }
    else if (p.code === "CIREBON") { mappingRule = "Keyword CIREBON"; businessConfirmation = true; }
    else if (p.code === "JL_GITAR") { mappingRule = "Keyword JL. GITAR / GITAR"; businessConfirmation = true; }
    else if (p.code === "INTERNAL") mappingRule = "Fallback operasional rutin kantor, BPJS, listrik, motor Jupiter, dll.";

    return {
      code: p.code,
      name: p.name,
      totalItems,
      totalApproved,
      totalRealized,
      subUnitBreakdown: subUnitCounts,
      mappingRule,
      status: businessConfirmation ? "REQUIRES BUSINESS CONFIRMATION" : "CONFIRMED_BY_SOURCE",
      sampleDescriptions
    };
  });

  console.log("\n--- PROJECT AUDIT TABLE ---");
  projectAudit.forEach(p => {
    console.log(`${p.code.padEnd(12)} | Items: ${p.totalItems.toString().padStart(4)} | App: Rp ${p.totalApproved.toLocaleString('id-ID').padStart(14)} | Real: Rp ${p.totalRealized.toLocaleString('id-ID').padStart(11)} | Status: ${p.status}`);
  });

  // 2. PIC Audit
  const pics = await prisma.fieldPic.findMany({
    include: {
      accExpenseItems: true
    }
  });

  const picAudit = pics.map(pic => {
    const totalItems = pic.accExpenseItems.length;
    const totalApproved = pic.accExpenseItems.reduce((s, i) => s + Number(i.approvedAmount), 0);
    const sampleDesc = Array.from(new Set(pic.accExpenseItems.map(i => i.description))).slice(0, 5);
    return {
      name: pic.name,
      roleTitle: pic.roleTitle,
      totalItems,
      totalApproved,
      sampleDesc
    };
  });

  console.log("\n--- PIC AUDIT TABLE ---");
  picAudit.forEach(p => {
    console.log(`${p.name.padEnd(12)} | Items: ${p.totalItems.toString().padStart(4)} | App: Rp ${p.totalApproved.toLocaleString('id-ID').padStart(14)} | Role: ${p.roleTitle || '-'}`);
  });

  // Deep inspection of Nisa's 724 items
  const nisa = pics.find(p => p.name === "NISA");
  const nisaItemsWithNisaInDesc = nisa?.accExpenseItems.filter(i => i.description.toUpperCase().includes("NISA")).length || 0;
  console.log(`\nNisa Analysis:`);
  console.log(`- Total items assigned to NISA: ${nisa?.accExpenseItems.length}`);
  console.log(`- Items explicitly mentioning NISA in description: ${nisaItemsWithNisaInDesc}`);
  console.log(`- Items assigned to NISA as administrative submitter fallback (no mandor keyword in desc): ${(nisa?.accExpenseItems.length || 0) - nisaItemsWithNisaInDesc}`);

  // 3. Database Safety Audit
  console.log("\n--- DATABASE SAFETY AUDIT ---");
  // A. Duplicate No Kas across batches (excluding null)
  const batchesWithNoKas = await prisma.submissionBatch.findMany({
    where: { noKas: { not: null } },
    select: { noKas: true }
  });
  const noKasCounts = new Map<string, number>();
  batchesWithNoKas.forEach(b => {
    noKasCounts.set(b.noKas!, (noKasCounts.get(b.noKas!) || 0) + 1);
  });
  const dupNoKas = Array.from(noKasCounts.entries()).filter(([_, c]) => c > 1);
  console.log(`Duplicate No Kas in SubmissionBatch: ${dupNoKas.length}`);

  // B. Duplicate (batchId, itemNo) in items
  const allItems = await prisma.accExpenseItem.findMany({
    select: { batchId: true, itemNo: true }
  });
  const itemKeys = new Set<string>();
  let dupBatchItemNo = 0;
  allItems.forEach(i => {
    const k = `${i.batchId}:${i.itemNo}`;
    if (itemKeys.has(k)) dupBatchItemNo++;
    itemKeys.add(k);
  });
  console.log(`Duplicate (batchId, itemNo) in AccExpenseItem: ${dupBatchItemNo}`);

  // C. Orphans
  const allBatchIds = new Set((await prisma.submissionBatch.findMany({ select: { id: true } })).map(b => b.id));
  const orphanItems = await prisma.accExpenseItem.findMany({
    where: { batchId: { notIn: Array.from(allBatchIds) } }
  });
  console.log(`Orphan AccExpenseItems (no batch): ${orphanItems.length}`);

  const allItemIds = new Set((await prisma.accExpenseItem.findMany({ select: { id: true } })).map(i => i.id));
  const orphanDisbItems = await prisma.disbursementItem.findMany({
    where: { accItemId: { notIn: Array.from(allItemIds) } }
  });
  console.log(`Orphan DisbursementItems (no acc item): ${orphanDisbItems.length}`);

  const allDisbIds = new Set((await prisma.disbursement.findMany({ select: { id: true } })).map(d => d.id));
  const orphanDisbItemParents = await prisma.disbursementItem.findMany({
    where: { disbursementId: { notIn: Array.from(allDisbIds) } }
  });
  console.log(`Orphan DisbursementItems (no disbursement parent): ${orphanDisbItemParents.length}`);

  const allJournalIds = new Set((await prisma.journalEntry.findMany({ select: { id: true } })).map(j => j.id));
  const orphanJournalLines = await prisma.journalLine.findMany({
    where: { journalId: { notIn: Array.from(allJournalIds) } }
  });
  console.log(`Orphan JournalLines (no journal parent): ${orphanJournalLines.length}`);

  fs.writeFileSync("project-pic-safety-audit.json", JSON.stringify({
    projectAudit,
    picAudit,
    nisaDetails: {
      total: nisa?.accExpenseItems.length,
      explicitMention: nisaItemsWithNisaInDesc,
      fallback: (nisa?.accExpenseItems.length || 0) - nisaItemsWithNisaInDesc
    },
    safety: {
      duplicateNoKasCount: dupNoKas.length,
      duplicateBatchItemNoCount: dupBatchItemNo,
      orphanItemsCount: orphanItems.length,
      orphanDisbItemsCount: orphanDisbItems.length,
      orphanDisbItemParentsCount: orphanDisbItemParents.length,
      orphanJournalLinesCount: orphanJournalLines.length
    }
  }, null, 2));

  console.log("Wrote project-pic-safety-audit.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
