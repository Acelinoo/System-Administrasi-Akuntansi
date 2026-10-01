import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { prisma } from "../src/lib/db/prisma";
import { parseAndMapRealWorkbook } from "../src/lib/finance/real-bulk-importer";
import { analyzeRealWorkbook } from "../tests/real-workbook-analyzer";

async function runReconciliation() {
  console.log("=== PHASE 8C.1 DEEP RECONCILIATION ENGINE ===");
  const targetFile = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");

  // A. RUN BOTH PARSERS
  console.log("1. Running Phase 8B Analyzer...");
  const p8bReport = await analyzeRealWorkbook(targetFile);

  console.log("2. Running Phase 8C Importer Parser...");
  const p8cParsed = await parseAndMapRealWorkbook(targetFile);

  // Compare No Kas sets
  const p8bNoKasMap = p8bReport.allFoundNoKas; // Map<string, { count, sheets, items }>
  const p8cNoKasMap = new Map(p8cParsed.uniqueVouchers.map((v) => [v.noKas, v]));

  const p8bNoKasSet = new Set(Array.from(p8bNoKasMap.keys()));
  const p8cNoKasSet = new Set(Array.from(p8cNoKasMap.keys()));

  console.log(`\n--- NO KAS RECONCILIATION ---`);
  console.log(`Phase 8B Unique No Kas: ${p8bNoKasSet.size}`);
  console.log(`Phase 8C Unique No Kas: ${p8cNoKasSet.size}`);

  const in8bNot8c = Array.from(p8bNoKasSet).filter((k) => !p8cNoKasSet.has(k));
  const in8cNot8b = Array.from(p8cNoKasSet).filter((k) => !p8bNoKasSet.has(k));

  console.log(`In 8B but not 8C (${in8bNot8c.length}):`, in8bNot8c);
  console.log(`In 8C but not 8B (${in8cNot8b.length}):`, in8cNot8b);

  // Detail why in 8B but not 8C: where did 8B find them?
  const in8bNot8cDetails = in8bNot8c.map((k) => ({
    noKas: k,
    data: p8bNoKasMap.get(k),
  }));

  // B. COMPARE ITEMS: 994 vs 1030
  console.log(`\n--- ITEMS RECONCILIATION (994 vs 1030) ---`);
  const p8cItems = p8cParsed.uniqueVouchers.flatMap((v) =>
    v.items.map((it) => ({
      noKas: v.noKas,
      itemNo: it.itemNo,
      description: it.description,
      approvedAmount: it.approvedAmount,
      realizedAmount: it.realizedAmount,
      appearances: v.sourceAppearances,
    }))
  );
  console.log(`Phase 8C Total Canonical Items: ${p8cItems.length}`);

  // How did 8B get 994?
  let p8bTotalItemCount = 0;
  p8bNoKasMap.forEach((v) => {
    p8bTotalItemCount += v.items.length;
  });
  console.log(`Phase 8B sum of unique descriptions across all No Kas: ${p8bTotalItemCount}`);

  // Let's inspect differences between 8B items and 8C items
  // In 8B, it was: Map of unique items per No Kas where desc was distinct string!
  // In 8C, an item is distinct if (description, approvedAmount) is distinct!
  // What if the same description has multiple rows with different amounts, or same description in same sheet?
  // Let's identify the exact 36 extra items in 8C!

  // C. DATABASE AUDIT & PROVENANCE
  console.log(`\n--- DATABASE PROVENANCE AUDIT ---`);
  const allDbBatches = await prisma.submissionBatch.findMany({
    include: {
      items: {
        include: {
          project: true,
          subUnit: true,
          category: true,
          subCategory: true,
          pic: true,
          disbursementItems: {
            include: {
              disbursement: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const allDbItems = allDbBatches.flatMap((b) => b.items);

  // Separate Pre-existing vs Real Excel
  // In Phase 8C, imported batches have batchCode like BATCH-KU-26-028-XXXX or notes like 'Sumber Excel: ...'
  // Or createdAt around import time vs earlier
  const preExistingBatches: typeof allDbBatches = [];
  const realExcelBatches: typeof allDbBatches = [];

  // Collision batches: 15 vouchers in DB that collided with Excel
  const excelNoKasUpper = new Set(Array.from(p8cNoKasSet).map((k) => k.toUpperCase()));

  for (const b of allDbBatches) {
    // Check if it was imported by Phase 8C bulk import:
    // Bulk importer sets batchCode: BATCH-${v.noKas.replace(/[^A-Za-z0-9]/g, "-")}-${Date.now()...}
    // and items have notes like "Sumber Excel: ..."
    const hasExcelNotes = b.items.some((i) => i.notes?.startsWith("Sumber Excel:"));
    if (hasExcelNotes) {
      realExcelBatches.push(b);
    } else {
      preExistingBatches.push(b);
    }
  }

  console.log(`Pre-existing Batches in DB: ${preExistingBatches.length}`);
  console.log(`Real Excel Batches in DB: ${realExcelBatches.length}`);
  console.log(`Total Batches: ${allDbBatches.length}`);

  const preExistingItems = preExistingBatches.flatMap((b) => b.items);
  const realExcelItems = realExcelBatches.flatMap((b) => b.items);

  console.log(`Pre-existing Items in DB: ${preExistingItems.length}`);
  console.log(`Real Excel Items in DB: ${realExcelItems.length}`);
  console.log(`Total Items: ${allDbItems.length}`);

  // Financial sums
  const preApproved = preExistingItems.reduce((s, i) => s + Number(i.approvedAmount), 0);
  const realApproved = realExcelItems.reduce((s, i) => s + Number(i.approvedAmount), 0);
  const totalDbApproved = allDbItems.reduce((s, i) => s + Number(i.approvedAmount), 0);

  const preRealized = preExistingItems.reduce(
    (s, i) => s + i.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0),
    0
  );
  const realRealized = realExcelItems.reduce(
    (s, i) => s + i.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0),
    0
  );
  const totalDbRealized = allDbItems.reduce(
    (s, i) => s + i.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0),
    0
  );

  console.log(`\n--- FINANCIAL TOTALS ---`);
  console.log(`Real Excel Approved in DB: Rp ${realApproved.toLocaleString("id-ID")}`);
  console.log(`Pre-existing Approved in DB: Rp ${preApproved.toLocaleString("id-ID")}`);
  console.log(`Total DB Approved: Rp ${totalDbApproved.toLocaleString("id-ID")}`);
  console.log(`Diff (Total - Real): Rp ${(totalDbApproved - realApproved).toLocaleString("id-ID")}`);

  console.log(`\nReal Excel Realized in DB: Rp ${realRealized.toLocaleString("id-ID")}`);
  console.log(`Pre-existing Realized in DB: Rp ${preRealized.toLocaleString("id-ID")}`);
  console.log(`Total DB Realized: Rp ${totalDbRealized.toLocaleString("id-ID")}`);

  // Disbursements & Journals & Inflows
  const allDisbursements = await prisma.disbursement.findMany({
    include: { items: true },
  });
  const allJournals = await prisma.journalEntry.findMany({
    include: { lines: true },
  });
  const allInflows = await prisma.fundInflow.findMany();

  // D. WRITE DETAILED AUDIT DATA TO JSON FOR PRECISE REPORTING
  const auditDump = {
    noKasReconciliation: {
      p8bCount: p8bNoKasSet.size,
      p8cCount: p8cNoKasSet.size,
      in8bNot8c: in8bNot8cDetails,
      in8cNot8b,
    },
    itemsSummary: {
      p8bItemCount: p8bTotalItemCount,
      p8cItemCount: p8cItems.length,
      diff: p8cItems.length - p8bTotalItemCount,
    },
    databaseSummary: {
      totalBatches: allDbBatches.length,
      preBatchesCount: preExistingBatches.length,
      realBatchesCount: realExcelBatches.length,
      totalItems: allDbItems.length,
      preItemsCount: preExistingItems.length,
      realItemsCount: realExcelItems.length,
      preApproved,
      realApproved,
      totalDbApproved,
      diffApproved: totalDbApproved - realApproved,
      preRealized,
      realRealized,
      totalDbRealized,
      diffRealized: totalDbRealized - realRealized,
      disbursementsCount: allDisbursements.length,
      journalsCount: allJournals.length,
      inflowsCount: allInflows.length,
    },
    preExistingBatchDetails: preExistingBatches.map((b) => ({
      batchCode: b.batchCode,
      noKas: b.noKas,
      accDate: b.accDate,
      notes: b.notes,
      itemCount: b.items.length,
      totalApproved: b.items.reduce((s, i) => s + Number(i.approvedAmount), 0),
      totalRealized: b.items.reduce(
        (s, i) => s + i.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0),
        0
      ),
    })),
  };

  fs.writeFileSync("audit-dump-initial.json", JSON.stringify(auditDump, null, 2));
  console.log("\nWrote audit-dump-initial.json");
}

runReconciliation().catch(console.error).finally(() => prisma.$disconnect());
