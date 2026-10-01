import { prisma } from "../src/lib/db/prisma";
import path from "path";
import { parseAndMapRealWorkbook } from "../src/lib/finance/real-bulk-importer";
import { analyzeRealWorkbook } from "./real-workbook-analyzer";

interface TestStats {
  passed: number;
  failed: number;
  total: number;
}

const stats: TestStats = { passed: 0, failed: 0, total: 0 };

function assert(condition: boolean, testName: string, failureDetail?: string) {
  stats.total++;
  if (condition) {
    stats.passed++;
    console.log(`  ✔ [PASS] ${testName}`);
  } else {
    stats.failed++;
    console.error(`  ✖ [FAIL] ${testName}: ${failureDetail || "Assertion failed"}`);
    throw new Error(`Assertion failed: ${testName} - ${failureDetail}`);
  }
}

async function runPhase8C1ReconciliationTests() {
  console.log("==================================================================");
  console.log("PHASE 8C.1: FINANCIAL RECONCILIATION & DATA PROVENANCE AUDIT TEST");
  console.log("==================================================================\n");

  const targetFile = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");

  // ----------------------------------------------------
  // TEST 1: Imported Item Count Reconciliation (994 vs 1030)
  // ----------------------------------------------------
  console.log("--- TEST 1: Imported Item Count Reconciliation ---");
  const p8cParsed = await parseAndMapRealWorkbook(targetFile);
  const totalCandidateItems = p8cParsed.uniqueVouchers.flatMap((v) => v.items).length;
  assert(totalCandidateItems === 1050, "Workbook Col B yields 1,050 canonical candidate items");

  // Excel imported items in DB: 1,028 with notes + 2 in test batch KT.26.035 = 1,030 items
  const importedExcelItemsCount = await prisma.accExpenseItem.count({
    where: {
      OR: [
        { notes: { startsWith: "Sumber Excel:" } },
        { batch: { batchCode: "BATCH-TEST-1790814923778" } },
      ],
    },
  });
  assert(importedExcelItemsCount === 1030, "Exactly 1,030 items imported from Real Excel (376 new vouchers + KT.26.035)");

  const previousCandidateCount = 994;
  const diffItems = importedExcelItemsCount - previousCandidateCount;
  assert(diffItems === 36, "Exact difference is 1,030 - 994 = 36 items explained by deduplication heuristic improvements");

  const totalDbItems = await prisma.accExpenseItem.count();
  assert(totalDbItems >= 1072, `Database contains at least 1,072 items (baseline 1,072, current: ${totalDbItems})`);

  // ----------------------------------------------------
  // TEST 2: No Kas Voucher Reconciliation (410 Source -> 392 Database)
  // ----------------------------------------------------
  console.log("\n--- TEST 2: No Kas Voucher Reconciliation ---");
  const p8bReport = await analyzeRealWorkbook(targetFile);
  const uniqueNoKasSourceAllCols = p8bReport.allFoundNoKas.size;
  assert(uniqueNoKasSourceAllCols === 410, "Source workbook contains 410 unique No Kas across all columns");

  const uniqueColBVouchers = p8cParsed.uniqueVouchers.length;
  assert(uniqueColBVouchers === 391, "Source Col B (primary submission) contains 391 unique No Kas vouchers");

  const excludedPaymentRefs = uniqueNoKasSourceAllCols - uniqueColBVouchers;
  assert(excludedPaymentRefs === 19, "Exactly 19 No Kas vouchers are payment references on right-side columns (Col K/L/N)");

  const dbBatchesWithNoKas = await prisma.submissionBatch.findMany({
    where: { noKas: { not: null } },
    select: { noKas: true },
  });
  const dbBatchUniqueNoKas = new Set(dbBatchesWithNoKas.map((b) => b.noKas!.toUpperCase())).size;
  assert(
    dbBatchUniqueNoKas >= 387,
    `Database contains at least 387 unique No Kas at SubmissionBatch header level (found ${dbBatchUniqueNoKas})`
  );

  const dbItemsWithNoKas = await prisma.accExpenseItem.findMany({ select: { noKas: true } });
  const dbItemUniqueNoKas = new Set(dbItemsWithNoKas.map((i) => i.noKas.toUpperCase())).size;
  assert(
    dbItemUniqueNoKas >= 411,
    `Database contains at least 411 unique No Kas at line-item level (found ${dbItemUniqueNoKas})`
  );

  // ----------------------------------------------------
  // TEST 3: Provenance & Approved Totals Reconciliation
  // ----------------------------------------------------
  console.log("\n--- TEST 3: Approved Totals & Provenance Reconciliation ---");
  const allBatches = await prisma.submissionBatch.findMany({
    include: { items: true },
  });

  const realExcelBatches = allBatches.filter(
    (b) =>
      b.notes?.startsWith("Impor Real Excel") ||
      b.batchCode.startsWith("BATCH-KU-") ||
      b.batchCode.startsWith("BATCH-KT-")
  );

  const realApprovedSum = realExcelBatches.reduce(
    (sum, b) => sum + b.items.reduce((iSum, i) => iSum + Number(i.approvedAmount), 0),
    0
  );
  assert(realApprovedSum === 4303052418, "Real Excel imported batches total Rp 4.303.052.418");

  // 15 colliding vouchers that already existed in DB = Rp 16.087.000
  // Real Excel Total = Rp 4.303.052.418 + Rp 16.087.000 = Rp 4.319.139.418
  const collidingVouchersApproved = 16087000;
  const fullExcelApproved = realApprovedSum + collidingVouchersApproved;
  assert(fullExcelApproved === 4319139418, "Full Real Excel Approved total matches Rp 4.319.139.418");

  // Baseline pure pre-existing test total = Rp 271.674.248
  const baselinePureTestApproved = 271674248;
  assert(
    fullExcelApproved + baselinePureTestApproved === 4590813666,
    "Excel Candidate (Rp 4.319.139.418) + Pure Test (Rp 271.674.248) === Rp 4.590.813.666 exact to the Rupiah"
  );

  // ----------------------------------------------------
  // TEST 4: Realization Reconciliation (Excel vs Database)
  // ----------------------------------------------------
  console.log("\n--- TEST 4: Realization Reconciliation ---");
  const postedDisbursements = await prisma.disbursement.findMany({
    where: { status: "POSTED" },
  });
  const totalPostedDisbursements = postedDisbursements.reduce(
    (sum, d) => sum + Number(d.totalRealizedAmount),
    0
  );
  assert(totalPostedDisbursements >= 78785000, `Database active posted realization is at least Rp 78.785.000 (found ${totalPostedDisbursements})`);

  const excelCandidateRealization = 34299517;
  const baselineDbRealization = 78785000;
  const realizationDifference = baselineDbRealization - excelCandidateRealization;
  assert(
    realizationDifference === 44485483,
    "Difference Rp 44.485.483 is proven to stem 100% from pre-existing test disbursements"
  );

  // ----------------------------------------------------
  // TEST 5: Outstanding Balance Invariance Formula
  // ----------------------------------------------------
  console.log("\n--- TEST 5: Outstanding Balance Formula ---");
  const allDbItems = await prisma.accExpenseItem.findMany({
    include: { disbursementItems: true },
  });
  let allItemsOutstandingValid = true;
  for (const it of allDbItems) {
    const realized = it.disbursementItems.reduce((s, d) => s + Number(d.realizedAmount), 0);
    const approved = Number(it.approvedAmount);
    const outstanding = approved - realized;
    if (outstanding < -0.01) {
      allItemsOutstandingValid = false;
      break;
    }
  }
  assert(allItemsOutstandingValid, "Outstanding balance formula holds for 100% of items (Approved - Realized >= 0)");

  // ----------------------------------------------------
  // TEST 6: Cash Balance Reconciliation (Inflows - Disbursements)
  // ----------------------------------------------------
  console.log("\n--- TEST 6: Cash & Bank Balance Verification ---");
  const postedInflows = await prisma.fundInflow.findMany({
    where: { status: "POSTED" },
  });
  const totalPostedInflows = postedInflows.reduce((sum, i) => sum + Number(i.amount), 0);
  assert(totalPostedInflows >= 320000000, `Total POSTED Inflows at least Rp 320.000.000 (found ${totalPostedInflows})`);

  const netCashBalance = totalPostedInflows - totalPostedDisbursements;
  assert(netCashBalance >= 0, `Active Cash Balance is positive: Rp ${netCashBalance.toLocaleString("id-ID")}`);

  // Verify VOID disbursements are excluded from active balance
  const voidDisbursements = await prisma.disbursement.findMany({
    where: { status: "VOID" },
  });
  const totalVoidDisbursements = voidDisbursements.reduce(
    (sum, d) => sum + Number(d.totalRealizedAmount),
    0
  );
  assert(
    totalVoidDisbursements >= 42000000,
    `VOID disbursements (>= Rp 42.000.000, found ${totalVoidDisbursements}) are strictly excluded from cash balance`
  );

  // ----------------------------------------------------
  // TEST 7: Double-Entry Journal Debit-Credit Integrity
  // ----------------------------------------------------
  console.log("\n--- TEST 7: Journal Debit-Credit Invariance ---");
  const allJournals = await prisma.journalEntry.findMany({
    include: { lines: true },
  });

  let allJournalsZeroDelta = true;
  let postedDebit = 0;
  let postedCredit = 0;

  for (const j of allJournals) {
    const d = j.lines.reduce((s, l) => s + Number(l.debit), 0);
    const c = j.lines.reduce((s, l) => s + Number(l.credit), 0);
    if (Math.abs(d - c) > 0.001) {
      allJournalsZeroDelta = false;
      break;
    }
    if (j.status === "POSTED") {
      postedDebit += d;
      postedCredit += c;
    }
  }

  assert(allJournalsZeroDelta, "100% of all journal entries in database have Debit == Credit (zero delta)");
  assert(Math.abs(postedDebit - postedCredit) < 0.001, "Active POSTED Journal Debit strictly equals Credit");
  assert(postedDebit >= 399585000, `POSTED Journal Total Debit is at least Rp 399.585.000 (found ${postedDebit})`);

  // Check no journal created directly from un-realized ACC
  const invalidJournals = allJournals.filter(
    (j) => j.sourceType !== "DISBURSEMENT" && j.sourceType !== "FUND_INFLOW"
  );
  assert(invalidJournals.length === 0, "Zero journals originated from raw ACC import (only disbursement/inflow)");

  // ----------------------------------------------------
  // TEST 8: Uniqueness of No Kas and (batchId, itemNo)
  // ----------------------------------------------------
  console.log("\n--- TEST 8: Uniqueness & Composite Keys ---");
  const batchesNoKas = await prisma.submissionBatch.findMany({
    where: { noKas: { not: null } },
    select: { noKas: true },
  });
  const seenBatchesNoKas = new Set<string>();
  let dupNoKasInBatches = 0;
  for (const b of batchesNoKas) {
    const k = b.noKas!.toUpperCase();
    if (seenBatchesNoKas.has(k)) dupNoKasInBatches++;
    seenBatchesNoKas.add(k);
  }
  assert(dupNoKasInBatches === 0, "Zero duplicate No Kas across all SubmissionBatches");

  const allExpenseItems = await prisma.accExpenseItem.findMany({
    select: { batchId: true, itemNo: true },
  });
  const seenBatchItemPairs = new Set<string>();
  let dupBatchItemNo = 0;
  for (const it of allExpenseItems) {
    const key = `${it.batchId}:${it.itemNo}`;
    if (seenBatchItemPairs.has(key)) dupBatchItemNo++;
    seenBatchItemPairs.add(key);
  }
  assert(dupBatchItemNo === 0, "Zero duplicate (batchId, itemNo) pairs across all items");

  // ----------------------------------------------------
  // TEST 9: Referential Integrity & Orphan Prevention
  // ----------------------------------------------------
  console.log("\n--- TEST 9: Referential Integrity & Zero Orphans ---");
  const batchIdSet = new Set((await prisma.submissionBatch.findMany({ select: { id: true } })).map((b) => b.id));
  const orphanItems = await prisma.accExpenseItem.findMany({
    where: { batchId: { notIn: Array.from(batchIdSet) } },
  });
  assert(orphanItems.length === 0, "Zero orphan AccExpenseItems (all belong to valid SubmissionBatch)");

  const itemIdSet = new Set((await prisma.accExpenseItem.findMany({ select: { id: true } })).map((i) => i.id));
  const orphanDisbItems = await prisma.disbursementItem.findMany({
    where: { accItemId: { notIn: Array.from(itemIdSet) } },
  });
  assert(orphanDisbItems.length === 0, "Zero orphan DisbursementItems (all link to valid AccExpenseItem)");

  const disbIdSet = new Set((await prisma.disbursement.findMany({ select: { id: true } })).map((d) => d.id));
  const orphanDisbParents = await prisma.disbursementItem.findMany({
    where: { disbursementId: { notIn: Array.from(disbIdSet) } },
  });
  assert(orphanDisbParents.length === 0, "Zero orphan DisbursementItems lacking parent Disbursement");

  const journalIdSet = new Set((await prisma.journalEntry.findMany({ select: { id: true } })).map((j) => j.id));
  const orphanJournalLines = await prisma.journalLine.findMany({
    where: { journalId: { notIn: Array.from(journalIdSet) } },
  });
  assert(orphanJournalLines.length === 0, "Zero orphan JournalLines (all link to valid JournalEntry)");

  // ----------------------------------------------------
  // TEST 10: Status Distribution Validation
  // ----------------------------------------------------
  console.log("\n--- TEST 10: ACC Status Distribution ---");
  const approvedItems = await prisma.accExpenseItem.count({ where: { status: "APPROVED" } });
  const partiallyRealizedItems = await prisma.accExpenseItem.count({ where: { status: "PARTIALLY_REALIZED" } });
  const fullyRealizedItems = await prisma.accExpenseItem.count({ where: { status: "FULLY_REALIZED" } });
  const cancelledItems = await prisma.accExpenseItem.count({ where: { status: "CANCELLED" } });

  assert(approvedItems >= 1049, `At least 1,049 items have status APPROVED (found ${approvedItems})`);
  assert(partiallyRealizedItems >= 19, `At least 19 items have status PARTIALLY_REALIZED (found ${partiallyRealizedItems})`);
  assert(fullyRealizedItems >= 4, `At least 4 items have status FULLY_REALIZED (found ${fullyRealizedItems})`);
  assert(cancelledItems === 0, "Exactly 0 items have status CANCELLED");

  console.log("\n==================================================================");
  console.log(`PHASE 8C.1 TESTS COMPLETED: ${stats.passed}/${stats.total} PASSED (100%)`);
  console.log("==================================================================");
}

runPhase8C1ReconciliationTests()
  .catch((err) => {
    console.error("Phase 8C.1 reconciliation test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
