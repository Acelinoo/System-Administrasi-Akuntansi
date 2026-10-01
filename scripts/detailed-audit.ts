import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { prisma } from "../src/lib/db/prisma";
import { parseAndMapRealWorkbook } from "../src/lib/finance/real-bulk-importer";
import { analyzeRealWorkbook } from "../tests/real-workbook-analyzer";

function getCellString(cell: ExcelJS.Cell): string {
  try {
    const val = cell.value;
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      const obj = val as unknown as Record<string, unknown>;
      if ("richText" in obj && Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text?: string }>).map((t) => t.text || "").join("").trim();
      }
      if ("text" in obj) return String(obj.text || "").trim();
      if ("result" in obj) return String(obj.result || "").trim();
    }
    return String(val).trim();
  } catch {
    return "";
  }
}

async function runDetailedAudit() {
  console.log("========================================================");
  console.log("   PHASE 8C.1: COMPREHENSIVE RECONCILIATION AUDIT       ");
  console.log("========================================================\n");

  const targetFile = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(targetFile);

  // ----------------------------------------------------
  // SECTION 1: 994 vs 1030 ITEM AUDIT & 410 vs 392 NO KAS
  // ----------------------------------------------------
  console.log(">>> Analyzing Workbook Structure for Phase 8B vs Phase 8C...");

  const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;

  // We will track every cell in recap sheets that matches noKasRegex
  interface RawHit {
    sheetName: string;
    sheetIndex: number;
    rowIdx: number;
    colIdx: number;
    colLetter: string;
    noKas: string;
    desc: string;
    pengajuan: number;
    pencairan: number;
  }

  const recapSheetHits: RawHit[] = [];
  const colBHits: RawHit[] = [];
  const otherColHits: RawHit[] = [];

  const recapSheetNames: string[] = [];

  for (let idx = 0; idx < wb.worksheets.length; idx++) {
    const ws = wb.worksheets[idx];
    const sheetName = ws.name.trim();

    let isRecap = false;
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const row = ws.getRow(r);
      let rowJoined = "";
      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
        rowJoined += " " + getCellString(row.getCell(c));
      }
      if (rowJoined.toUpperCase().includes("REKAPAN PENGAJUAN") || rowJoined.toUpperCase().includes("POSISI KAS")) {
        isRecap = true;
        break;
      }
    }
    if (!isRecap) continue;
    recapSheetNames.push(sheetName);

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const maxCol = Math.min(ws.columnCount, 50);

      for (let c = 1; c <= maxCol; c++) {
        const val = getCellString(row.getCell(c));
        if (noKasRegex.test(val)) {
          const noKas = val.toUpperCase();
          const desc = getCellString(row.getCell(c + 1));
          const pengajuan = parseFloat(getCellString(row.getCell(c + 2)).replace(/[^0-9.-]/g, "") || "0");
          const pencairan = parseFloat(getCellString(row.getCell(c + 3)).replace(/[^0-9.-]/g, "") || "0");

          const hit: RawHit = {
            sheetName,
            sheetIndex: idx + 1,
            rowIdx: r,
            colIdx: c,
            colLetter: String.fromCharCode(64 + c),
            noKas,
            desc,
            pengajuan: isNaN(pengajuan) ? 0 : pengajuan,
            pencairan: isNaN(pencairan) ? 0 : pencairan,
          };

          recapSheetHits.push(hit);
          if (c === 2) {
            colBHits.push(hit);
          } else {
            otherColHits.push(hit);
          }
        }
      }
    }
  }

  console.log(`Total Recap Sheets: ${recapSheetNames.length}`);
  console.log(`Total No Kas Hits in Recap Sheets (All Cols): ${recapSheetHits.length}`);
  console.log(`Total No Kas Hits in Col B (Left side): ${colBHits.length}`);
  console.log(`Total No Kas Hits in Other Cols (Right side / etc): ${otherColHits.length}`);

  const uniqueNoKasAllCols = new Set(recapSheetHits.map((h) => h.noKas));
  const uniqueNoKasColB = new Set(colBHits.map((h) => h.noKas));
  const uniqueNoKasOtherCols = new Set(otherColHits.map((h) => h.noKas));

  console.log(`Unique No Kas All Cols: ${uniqueNoKasAllCols.size}`);
  console.log(`Unique No Kas Col B only: ${uniqueNoKasColB.size}`);
  console.log(`Unique No Kas Other Cols only: ${uniqueNoKasOtherCols.size}`);

  // The 19 No Kas in 8B but not in 8C:
  const inOtherColsOnly = Array.from(uniqueNoKasAllCols).filter((k) => !uniqueNoKasColB.has(k));
  console.log(`No Kas appearing ONLY in other cols (not Col B): ${inOtherColsOnly.length}`);
  console.log(`List:`, inOtherColsOnly);

  // Detail where these 19 No Kas appear:
  const details19 = inOtherColsOnly.map((k) => {
    const hits = otherColHits.filter((h) => h.noKas === k);
    return {
      noKas: k,
      occurrences: hits.length,
      locations: hits.map((h) => `${h.sheetName} (R${h.rowIdx}C${h.colIdx}/${h.colLetter})`),
      descriptions: Array.from(new Set(hits.map((h) => h.desc))),
      amounts: hits.map((h) => h.pengajuan),
    };
  });

  // Now, how did Phase 8B report "994 candidate line items"?
  // Let's inspect Phase 8B report text:
  // "Total Rows Analyzed: 994 line items across Type A recap sheets"
  // And Phase 8C reported: "1.030 imported ACC items"
  // Let's run Phase 8C parseAndMapRealWorkbook:
  const p8cData = await parseAndMapRealWorkbook(targetFile);
  const p8cVouchers = p8cData.uniqueVouchers;
  const p8cItems = p8cVouchers.flatMap((v) =>
    v.items.map((it) => ({
      noKas: v.noKas,
      itemNo: it.itemNo,
      description: it.description,
      approvedAmount: it.approvedAmount,
      realizedAmount: it.realizedAmount,
      projectId: it.projectId,
      projectCode: it.projectCode,
      categoryId: it.categoryId,
      categoryCode: it.categoryCode,
      picId: it.picId,
      picName: it.picName,
      notes: it.notes,
      sourceAppearances: v.sourceAppearances,
    }))
  );

  console.log(`Phase 8C parsed canonical vouchers: ${p8cVouchers.length}`);
  console.log(`Phase 8C parsed canonical items: ${p8cItems.length}`);

  // ----------------------------------------------------
  // SECTION 2: DATABASE AUDIT (BATAL, REAL, PRE-EXISTING)
  // ----------------------------------------------------
  console.log("\n>>> Auditing Database State...");
  const dbBatches = await prisma.submissionBatch.findMany({
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
        orderBy: { itemNo: "asc" },
      },
      createdBy: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const dbItems = dbBatches.flatMap((b) => b.items);

  // Group DB Batches:
  // Pre-existing: Batches that were NOT imported in Phase 8C bulk import
  // How to distinguish?
  // In Phase 8C, `executeRealDataBulkImport` created batches where `batchCode` starts with `BATCH-${v.noKas...}`
  // Let's check each batch:
  const realExcelBatches: typeof dbBatches = [];
  const preExistingBatches: typeof dbBatches = [];

  for (const b of dbBatches) {
    // Phase 8C imported items all have notes starting with "Sumber Excel:"
    // or batchCode generated by bulk importer
    const isExcelImported = b.items.some((i) => i.notes?.includes("Sumber Excel:"));
    if (isExcelImported) {
      realExcelBatches.push(b);
    } else {
      preExistingBatches.push(b);
    }
  }

  const realExcelItems = realExcelBatches.flatMap((b) => b.items);
  const preExistingItems = preExistingBatches.flatMap((b) => b.items);

  console.log(`Total Batches in DB: ${dbBatches.length}`);
  console.log(`  - Real Excel Batches: ${realExcelBatches.length}`);
  console.log(`  - Pre-existing Batches: ${preExistingBatches.length}`);

  console.log(`Total Items in DB: ${dbItems.length}`);
  console.log(`  - Real Excel Items: ${realExcelItems.length}`);
  console.log(`  - Pre-existing Items: ${preExistingItems.length}`);

  // Financial sums
  const sumRealApproved = realExcelItems.reduce((s, i) => s + Number(i.approvedAmount), 0);
  const sumPreApproved = preExistingItems.reduce((s, i) => s + Number(i.approvedAmount), 0);
  const sumTotalApproved = dbItems.reduce((s, i) => s + Number(i.approvedAmount), 0);

  console.log(`\nApproved Totals:`);
  console.log(`  - Real Excel Items Approved: Rp ${sumRealApproved.toLocaleString("id-ID")}`);
  console.log(`  - Pre-existing Items Approved: Rp ${sumPreApproved.toLocaleString("id-ID")}`);
  console.log(`  - Total DB Approved: Rp ${sumTotalApproved.toLocaleString("id-ID")}`);
  console.log(`  - Difference (Total - Real): Rp ${(sumTotalApproved - sumRealApproved).toLocaleString("id-ID")}`);

  // Disbursements & Realized
  const allDisbursements = await prisma.disbursement.findMany({
    include: {
      items: {
        include: {
          accItem: true,
        },
      },
      cashAccount: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const sumTotalRealizedInDb = allDisbursements
    .filter((d) => d.status === "POSTED")
    .reduce((s, d) => s + Number(d.totalRealizedAmount), 0);

  console.log(`\nDisbursements in DB: ${allDisbursements.length}`);
  const postedDisbursements = allDisbursements.filter((d) => d.status === "POSTED");
  const voidDisbursements = allDisbursements.filter((d) => d.status === "VOID");
  console.log(`  - POSTED Disbursements: ${postedDisbursements.length}, Total: Rp ${sumTotalRealizedInDb.toLocaleString("id-ID")}`);
  console.log(`  - VOID Disbursements: ${voidDisbursements.length}`);

  // Fund Inflows
  const allInflows = await prisma.fundInflow.findMany({
    include: { destinationAccount: true },
    orderBy: { createdAt: "asc" },
  });
  const postedInflows = allInflows.filter((i) => i.status === "POSTED");
  const voidInflows = allInflows.filter((i) => i.status === "VOID");
  const sumPostedInflows = postedInflows.reduce((s, i) => s + Number(i.amount), 0);
  console.log(`\nInflows in DB: ${allInflows.length}`);
  console.log(`  - POSTED Inflows: ${postedInflows.length}, Total: Rp ${sumPostedInflows.toLocaleString("id-ID")}`);
  console.log(`  - VOID Inflows: ${voidInflows.length}`);

  // Cash Balance
  const netCashBalance = sumPostedInflows - sumTotalRealizedInDb;
  console.log(`\nNet Cash Balance (Inflows - Posted Disbursements): Rp ${netCashBalance.toLocaleString("id-ID")}`);

  // Journals
  const allJournals = await prisma.journalEntry.findMany({
    include: {
      lines: {
        include: { coa: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const postedJournals = allJournals.filter((j) => j.status === "POSTED");
  const voidJournals = allJournals.filter((j) => j.status === "VOID");

  let totalDebit = 0;
  let totalCredit = 0;
  postedJournals.forEach((j) => {
    j.lines.forEach((l) => {
      totalDebit += Number(l.debit);
      totalCredit += Number(l.credit);
    });
  });

  console.log(`\nJournals in DB: ${allJournals.length}`);
  console.log(`  - POSTED Journals: ${postedJournals.length}`);
  console.log(`  - VOID Journals: ${voidJournals.length}`);
  console.log(`  - Total Debit: Rp ${totalDebit.toLocaleString("id-ID")}`);
  console.log(`  - Total Credit: Rp ${totalCredit.toLocaleString("id-ID")}`);
  console.log(`  - Journal Balance Delta: Rp ${(totalDebit - totalCredit).toLocaleString("id-ID")}`);

  // Status Distribution of ACC items
  const statusCounts: Record<string, number> = {};
  dbItems.forEach((it) => {
    statusCounts[it.status] = (statusCounts[it.status] || 0) + 1;
  });
  console.log(`\nACC Expense Items Status Distribution:`, statusCounts);

  // Write full raw data to JSON for comprehensive analysis
  fs.writeFileSync(
    "audit-detailed-output.json",
    JSON.stringify(
      {
        recapSheetCount: recapSheetNames.length,
        colBHitsCount: colBHits.length,
        otherColHitsCount: otherColHits.length,
        uniqueNoKasAllCols: uniqueNoKasAllCols.size,
        uniqueNoKasColB: uniqueNoKasColB.size,
        inOtherColsOnly: details19,
        p8cCanonicalVouchersCount: p8cVouchers.length,
        p8cCanonicalItemsCount: p8cItems.length,
        dbTotalBatches: dbBatches.length,
        dbRealExcelBatches: realExcelBatches.length,
        dbPreExistingBatches: preExistingBatches.length,
        dbTotalItems: dbItems.length,
        dbRealExcelItems: realExcelItems.length,
        dbPreExistingItems: preExistingItems.length,
        sumRealApproved,
        sumPreApproved,
        sumTotalApproved,
        disbursements: allDisbursements.map((d) => ({
          id: d.id,
          number: d.disbursementNumber,
          date: d.disbursementDate,
          method: d.paymentMethod,
          account: d.cashAccount.accountCode,
          amount: Number(d.totalRealizedAmount),
          status: d.status,
          notes: d.notes,
          itemCount: d.items.length,
        })),
        inflows: allInflows.map((i) => ({
          id: i.id,
          number: i.inflowNumber,
          date: i.inflowDate,
          account: i.destinationAccount.accountCode,
          amount: Number(i.amount),
          status: i.status,
          source: i.sourceInfo,
        })),
        journals: allJournals.map((j) => ({
          id: j.id,
          number: j.journalNumber,
          date: j.entryDate,
          sourceType: j.sourceType,
          sourceId: j.sourceId,
          status: j.status,
          totalDebit: j.lines.reduce((s, l) => s + Number(l.debit), 0),
          totalCredit: j.lines.reduce((s, l) => s + Number(l.credit), 0),
          lineCount: j.lines.length,
        })),
        preExistingBatchesSummary: preExistingBatches.map((b) => ({
          id: b.id,
          batchCode: b.batchCode,
          noKas: b.noKas,
          accDate: b.accDate,
          notes: b.notes,
          itemsCount: b.items.length,
          totalApproved: b.items.reduce((s, i) => s + Number(i.approvedAmount), 0),
        })),
        statusCounts,
      },
      null,
      2
    )
  );

  console.log("\nWrote audit-detailed-output.json successfully.");
}

runDetailedAudit().catch(console.error).finally(() => prisma.$disconnect());
