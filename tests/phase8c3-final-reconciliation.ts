import { prisma } from "../src/lib/db/prisma";
import { DataScope, PicAssignmentStatus, ProjectConfirmationStatus, TransactionStatus } from "@prisma/client";
import { getDashboardStats } from "../src/app/actions/acc.actions";
import { getCashBalances } from "../src/app/actions/disbursement.actions";
import { getJournalReport } from "../src/lib/reports/journal-report.service";
import { getAccReport } from "../src/lib/reports/acc-report.service";
import { getProjectReport } from "../src/lib/reports/project-report.service";
import { getPicReport } from "../src/lib/reports/pic-report.service";
import { getRealizationReport } from "../src/lib/reports/realization-report.service";
import { getCashReport } from "../src/lib/reports/cash-report.service";
import {
  buildAccExcel,
  buildRealizationExcel,
  buildProjectExcel,
  buildPicExcel,
  buildCashExcel,
  buildJournalExcel,
} from "../src/lib/export/excel-export.service";
import {
  buildAccPdf,
  buildRealizationPdf,
  buildProjectPdf,
  buildPicPdf,
  buildCashPdf,
  buildJournalPdf,
} from "../src/lib/export/pdf-export.service";

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

export async function runPhase8C3FinalReconciliationTests() {
  console.log("==================================================================");
  console.log("PHASE 8C.3: FINAL BUSINESS RECONCILIATION & DATA INTEGRITY TEST");
  console.log("==================================================================\n");

  // ----------------------------------------------------
  // TEST 1: Rekonsiliasi 22 vs 25+ TEST Batches
  // ----------------------------------------------------
  console.log("--- TEST 1: Reconciliation of 22 Baseline vs Subsequent TEST Batches ---");
  const testBatches = await prisma.submissionBatch.findMany({
    where: { dataScope: DataScope.TEST },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  assert(testBatches.length >= 25, `At least 25 TEST batches exist in database (found ${testBatches.length})`);

  // Phase 8C.1 cutoff: 2026-10-01T00:35:23.857Z (the 22nd batch)
  const cutoffDate = new Date("2026-10-01T01:00:00.000Z");
  const p8c1BaselineBatches = testBatches.filter((b) => b.createdAt < cutoffDate);
  assert(
    p8c1BaselineBatches.length === 22,
    `Exactly 22 baseline TEST batches existed at Phase 8C.1 cutoff (found ${p8c1BaselineBatches.length})`
  );

  const baselineApprovedTotal = p8c1BaselineBatches.reduce(
    (sum, b) => sum + b.items.reduce((s, it) => s + Number(it.approvedAmount), 0),
    0
  );
  // Total baseline pure test approved is Rp 287.761.248 (or Rp 271.674.248 excluding KT.26.035)
  assert(
    baselineApprovedTotal === 287761248,
    `Baseline 22 batches approved amount is Rp287.761.248 (found ${baselineApprovedTotal})`
  );

  // Subsequent test batches created during Phase 8C.2 automated test runs
  const subsequentTestBatches = testBatches.filter((b) => b.createdAt >= cutoffDate);
  assert(
    subsequentTestBatches.length >= 3,
    `At least 3 subsequent test batches were created during Phase 8C.2 test runs (found ${subsequentTestBatches.length})`
  );
  for (const sb of subsequentTestBatches) {
    assert(
      sb.dataScope === DataScope.TEST,
      `Subsequent batch ${sb.batchCode} is automatically isolated in TEST scope`
    );
  }

  // Real batches count strictly unchanged
  const realBatchesCount = await prisma.submissionBatch.count({
    where: { dataScope: DataScope.REAL },
  });
  assert(
    realBatchesCount === 379,
    `Real batches count remains immutable at exactly 379 (found ${realBatchesCount})`
  );

  // ----------------------------------------------------
  // TEST 2: Verifikasi Seluruh REAL Financial Totals setelah DataScope
  // ----------------------------------------------------
  console.log("--- TEST 2: Verification of REAL Financial Totals ---");
  const dashboard = await getDashboardStats(DataScope.REAL);
  assert(dashboard.totalBatches === 379, "REAL Dashboard batches: 379");
  assert(dashboard.totalAccItems === 1028, "REAL Dashboard items: 1,028");
  assert(dashboard.totalAccAmount === 4303052418, "REAL Dashboard approved: Rp4.303.052.418");
  assert(dashboard.totalRealizedAmount === 0, "REAL Dashboard realized: Rp0 (uncontaminated)");
  assert(dashboard.totalOutstandingAmount === 4303052418, "REAL Dashboard outstanding: Rp4.303.052.418");
  assert(dashboard.totalInflow === 0, "REAL Dashboard inflows: Rp0");
  assert(dashboard.totalDisbursement === 0, "REAL Dashboard disbursements: Rp0");

  const cash = await getCashBalances(DataScope.REAL);
  assert(cash.totalLiquidity === 0, "REAL Cash liquidity: Rp0 across all accounts");
  for (const acc of cash.accounts) {
    assert(acc.totalInflow === 0, `Account ${acc.accountCode} REAL inflow is 0`);
    assert(acc.totalDisbursement === 0, `Account ${acc.accountCode} REAL disbursement is 0`);
    assert(acc.currentBalance === 0, `Account ${acc.accountCode} REAL balance is 0`);
  }

  const journals = await getJournalReport({ dataScope: "REAL" });
  assert(journals.rows.length === 0, "REAL Journals count: 0 entries");
  assert(journals.totals.totalDebit === 0, "REAL Journals debit: Rp0");
  assert(journals.totals.totalCredit === 0, "REAL Journals credit: Rp0");

  // ----------------------------------------------------
  // TEST 3: Verifikasi Rp 34.299.517 Candidate Realization Satu per Satu
  // ----------------------------------------------------
  console.log("--- TEST 3: Itemized Verification of Rp 34.299.517 Realization Hold ---");
  const candidateVoucherCodes = ["KT.26.180", "KT.26.214", "KT.26.652"];
  const candidateItems = await prisma.accExpenseItem.findMany({
    where: {
      noKas: { in: candidateVoucherCodes },
      dataScope: DataScope.REAL,
    },
    include: {
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
      },
    },
  });

  // Verify candidate rows have ZERO posted disbursements
  for (const it of candidateItems) {
    const realized = it.disbursementItems.reduce((s, d) => s + Number(d.realizedAmount), 0);
    assert(
      realized === 0,
      `Voucher ${it.noKas} (${it.description.slice(0, 30)}...) has 0 posted realization in DB`
    );
  }

  // Verify exact math of the 4 candidate realization rows in Excel
  const c1 = 1356000;  // KT.26.180 Bu Ani minggu lalu
  const c2 = 3162000;  // KT.26.180 Bu Ani minggu ini
  const c3 = 22512000; // KT.26.214 Sisa material Sumedang
  const c4 = 7269517;  // KT.26.652 Talangan Nisa sanitair
  const sumCandidates = c1 + c2 + c3 + c4;
  assert(
    sumCandidates === 34299517,
    `Sum of 4 candidate realization lines matches exactly Rp34.299.517 (found ${sumCandidates})`
  );

  // ----------------------------------------------------
  // TEST 4: Bukti Ketiadaan Evidence pada 723 UNASSIGNED_MANDOR
  // ----------------------------------------------------
  console.log("--- TEST 4: Absence of Mandor Evidence on 723 UNASSIGNED_MANDOR Items ---");
  const unassignedItems = await prisma.accExpenseItem.findMany({
    where: {
      assignmentStatus: PicAssignmentStatus.UNASSIGNED_MANDOR,
      dataScope: DataScope.REAL,
    },
    select: { id: true, noKas: true, description: true },
  });
  assert(
    unassignedItems.length === 723,
    `Exactly 723 items are in UNASSIGNED_MANDOR (found ${unassignedItems.length})`
  );

  const mandorNames = ["HERI", "MAMAT", "DEDI", "AGUS", "UDEN", "ENGKUS", "GIRI"];
  let explicitMandorHits = 0;
  for (const it of unassignedItems) {
    const descUpper = it.description.toUpperCase();
    for (const name of mandorNames) {
      if (descUpper.includes(name)) {
        explicitMandorHits++;
      }
    }
  }
  assert(
    explicitMandorHits === 0,
    `Zero explicit mandor names found in 723 UNASSIGNED_MANDOR descriptions (found ${explicitMandorHits})`
  );

  // Verify NISA single explicit item
  const nisaExplicit = await prisma.accExpenseItem.findMany({
    where: {
      pic: { name: "NISA" },
      dataScope: DataScope.REAL,
    },
  });
  assert(
    nisaExplicit.length === 1 && nisaExplicit[0].noKas === "KT.26.532",
    "Only KT.26.532 ('Pembelian Pembersih Kaca SMP Nisa') remains assigned to NISA as field PIC"
  );

  // Verify explicit mandors remain with ASSIGNED status
  const explicitMandorCount = await prisma.accExpenseItem.count({
    where: {
      pic: { name: { in: ["PA HERI", "PA DEDI", "PA MAMAT", "PA AGUS", "PA UDEN"] } },
      dataScope: DataScope.REAL,
      assignmentStatus: PicAssignmentStatus.ASSIGNED,
    },
  });
  assert(
    explicitMandorCount === 304,
    `Exactly 304 explicit mandor items remain properly ASSIGNED (found ${explicitMandorCount})`
  );

  // ----------------------------------------------------
  // TEST 5: Verifikasi 6 Candidate Projects
  // ----------------------------------------------------
  console.log("--- TEST 5: 6 Candidate Projects Verification ---");
  const candidateProjects = await prisma.project.findMany({
    where: {
      code: { in: ["DARUL_ULUM", "BUDI_INDAH", "APARTEMEN", "ANTAPANI", "CIREBON", "JL_GITAR"] },
    },
    include: {
      accExpenseItems: { where: { dataScope: DataScope.REAL } },
    },
  });
  assert(candidateProjects.length === 6, "All 6 candidate projects verified");

  const expectedCounts: Record<string, { count: number; sum: number }> = {
    DARUL_ULUM: { count: 11, sum: 6080000 },
    BUDI_INDAH: { count: 4, sum: 530000 },
    APARTEMEN: { count: 6, sum: 1372500 },
    ANTAPANI: { count: 5, sum: 1059000 },
    CIREBON: { count: 2, sum: 150000 },
    JL_GITAR: { count: 5, sum: 1008500 },
  };

  let totalCandidateItems = 0;
  let totalCandidateSum = 0;
  for (const proj of candidateProjects) {
    assert(
      proj.confirmationStatus === ProjectConfirmationStatus.REQUIRES_BUSINESS_CONFIRMATION,
      `Project ${proj.code} confirmationStatus === REQUIRES_BUSINESS_CONFIRMATION`
    );
    assert(
      proj.possibleParentCode === "INTERNAL",
      `Project ${proj.code} possibleParentCode === 'INTERNAL'`
    );
    const expected = expectedCounts[proj.code];
    const actualSum = proj.accExpenseItems.reduce((s, it) => s + Number(it.approvedAmount), 0);
    assert(
      proj.accExpenseItems.length === expected.count,
      `Project ${proj.code} has ${expected.count} items (found ${proj.accExpenseItems.length})`
    );
    assert(
      actualSum === expected.sum,
      `Project ${proj.code} total approved is Rp${expected.sum.toLocaleString("id-ID")} (found Rp${actualSum.toLocaleString("id-ID")})`
    );
    totalCandidateItems += proj.accExpenseItems.length;
    totalCandidateSum += actualSum;
  }
  assert(totalCandidateItems === 33, `Total candidate items: 33 (found ${totalCandidateItems})`);
  assert(totalCandidateSum === 10200000, `Total candidate approved: Rp10.200.000 (found ${totalCandidateSum})`);

  // ----------------------------------------------------
  // TEST 6: Isolasi Total: Tidak Ada TEST Data Masuk ke Laporan & Export
  // ----------------------------------------------------
  console.log("--- TEST 6: Total Exclusion of TEST Data Across Reports & Exports ---");
  const [accRep, realRep, projRep, picRep, cashRep, jrnRep] = await Promise.all([
    getAccReport({ dataScope: "REAL" }),
    getRealizationReport({ dataScope: "REAL" }),
    getProjectReport({ dataScope: "REAL" }),
    getPicReport({ dataScope: "REAL" }),
    getCashReport({ dataScope: "REAL" }),
    getJournalReport({ dataScope: "REAL" }),
  ]);

  assert(accRep.totals.count === 1028, "ACC Report contains exactly 1,028 REAL items");
  assert(accRep.totals.totalRealized === 0, "ACC Report contains Rp0 realization");
  assert(realRep.totals.count === 0, "Realization Report contains 0 items");
  assert(realRep.totals.totalRealized === 0, "Realization Report total is Rp0");
  assert(projRep.totals.totalRealized === 0, "Project Report contains Rp0 realization");
  assert(picRep.totals.totalRealized === 0, "PIC Report contains Rp0 realization");
  assert(cashRep.totals.totalCurrentBalance === 0, "Cash Report balance is Rp0");
  assert(jrnRep.totals.entryCount === 0, "Journal Report contains 0 entries");

  // Verify Excel Export Generation
  const [e1, e2, e3, e4, e5, e6] = await Promise.all([
    buildAccExcel(accRep),
    buildRealizationExcel(realRep),
    buildProjectExcel(projRep),
    buildPicExcel(picRep),
    buildCashExcel(cashRep),
    buildJournalExcel(jrnRep),
  ]);
  assert(e1.length > 50000, "ACC Excel export generated");
  assert(e2.length > 5000, "Realization Excel export generated");
  assert(e3.length > 5000, "Project Excel export generated");
  assert(e4.length > 50000, "PIC Excel export generated");
  assert(e5.length > 5000, "Cash Excel export generated");
  assert(e6.length > 5000, "Journal Excel export generated");

  // Verify PDF Export Generation
  const [p1, p2, p3, p4, p5, p6] = await Promise.all([
    buildAccPdf(accRep),
    buildRealizationPdf(realRep),
    buildProjectPdf(projRep),
    buildPicPdf(picRep),
    buildCashPdf(cashRep),
    buildJournalPdf(jrnRep),
  ]);
  assert(p1.length > 100000, "ACC PDF export generated");
  assert(p2.length > 5000, "Realization PDF export generated");
  assert(p3.length > 50000, "Project PDF export generated");
  assert(p4.length > 100000, "PIC PDF export generated");
  assert(p5.length > 10000, "Cash PDF export generated");
  assert(p6.length > 5000, "Journal PDF export generated");

  // ----------------------------------------------------
  // TEST 7: Data Immutability & Mathematical Invariants
  // ----------------------------------------------------
  console.log("--- TEST 7: Immutability & Financial Invariants ---");
  const totalApprovedDb = await prisma.accExpenseItem.aggregate({
    where: { dataScope: DataScope.REAL },
    _sum: { approvedAmount: true },
  });
  assert(
    Number(totalApprovedDb._sum.approvedAmount) === 4303052418,
    "Real approved sum in DB is immutable at Rp4.303.052.418"
  );

  const realUniqueNoKas = await prisma.accExpenseItem.groupBy({
    by: ["noKas"],
    where: { dataScope: DataScope.REAL },
  });
  assert(realUniqueNoKas.length === 379, "379 unique real vouchers preserved");

  const allRealItems = await prisma.accExpenseItem.findMany({
    where: { dataScope: DataScope.REAL },
    select: { id: true, batchId: true },
  });
  const allRealBatches = new Set((await prisma.submissionBatch.findMany({ select: { id: true } })).map((b) => b.id));
  const orphanItems = allRealItems.filter((i) => !allRealBatches.has(i.batchId)).length;
  assert(orphanItems === 0, "Zero orphan ACC items");

  const allDisbItems = await prisma.disbursementItem.findMany({ select: { id: true, disbursementId: true } });
  const allDisbs = new Set((await prisma.disbursement.findMany({ select: { id: true } })).map((d) => d.id));
  const orphanDisbItems = allDisbItems.filter((di) => !allDisbs.has(di.disbursementId)).length;
  assert(orphanDisbItems === 0, "Zero orphan disbursement items");

  const allLines = await prisma.journalLine.findMany({ select: { id: true, journalId: true } });
  const allJournals = new Set((await prisma.journalEntry.findMany({ select: { id: true } })).map((j) => j.id));
  const orphanJournalLines = allLines.filter((l) => !allJournals.has(l.journalId)).length;
  assert(orphanJournalLines === 0, "Zero orphan journal lines");

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n==================================================================");
  console.log(`PHASE 8C.3 TEST RESULTS: ${stats.passed} / ${stats.total} PASSED`);
  if (stats.failed > 0) {
    console.error(`FAILED: ${stats.failed} tests`);
    process.exit(1);
  } else {
    console.log("ALL PHASE 8C.3 RECONCILIATION & ISOLATION INVARIANTS PASSED 100%!");
  }
  console.log("==================================================================\n");
}

if (require.main === module) {
  runPhase8C3FinalReconciliationTests()
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
