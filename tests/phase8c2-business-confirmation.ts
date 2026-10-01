import { prisma } from "../src/lib/db/prisma";
import { DataScope, PicAssignmentStatus, ProjectConfirmationStatus, TransactionStatus } from "@prisma/client";
import { getDashboardStats } from "../src/app/actions/acc.actions";
import { getCashBalances } from "../src/app/actions/disbursement.actions";
import { getJournalReport } from "../src/lib/reports/journal-report.service";
import { getAccReport } from "../src/lib/reports/acc-report.service";

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

export async function runPhase8C2BusinessConfirmationTests() {
  console.log("==================================================================");
  console.log("PHASE 8C.2: BUSINESS CONFIRMATION, ROLE SEPARATION & DATA ISOLATION");
  console.log("==================================================================\n");

  // ----------------------------------------------------
  // TEST 1: Administrative Submitter Nisa tidak otomatis menjadi field PIC
  // ----------------------------------------------------
  console.log("--- TEST 1: Administrative Submitter Separation ---");
  const nisaPic = await prisma.fieldPic.findUnique({
    where: { name: "NISA" },
  });
  assert(!!nisaPic, "NISA PIC record exists in database");
  assert(
    nisaPic?.roleTitle === "ADMINISTRATIVE_SUBMITTER",
    "NISA roleTitle is explicitly set to ADMINISTRATIVE_SUBMITTER"
  );

  const realNisaItems = await prisma.accExpenseItem.findMany({
    where: {
      picId: nisaPic!.id,
      dataScope: DataScope.REAL,
    },
  });
  assert(
    realNisaItems.length === 1,
    `Only 1 item explicitly remains under NISA as field PIC (expected 1, found ${realNisaItems.length})`
  );
  assert(
    realNisaItems[0].noKas === "KT.26.532",
    `The single NISA item is KT.26.532 (Pembelian Pembersih Kaca SMP Nisa), found ${realNisaItems[0]?.noKas}`
  );
  assert(
    Number(realNisaItems[0].approvedAmount) === 259750,
    `NISA single item amount is Rp259.750, found ${Number(realNisaItems[0]?.approvedAmount)}`
  );

  // ----------------------------------------------------
  // TEST 2: Item tanpa evidence PIC -> UNASSIGNED_MANDOR
  // ----------------------------------------------------
  console.log("--- TEST 2: Fallback Items Assigned to UNASSIGNED_MANDOR ---");
  const unassignedMandor = await prisma.fieldPic.findUnique({
    where: { name: "UNASSIGNED_MANDOR" },
  });
  assert(!!unassignedMandor, "UNASSIGNED_MANDOR master record exists");
  assert(
    unassignedMandor?.roleTitle === "MANDOR_BELUM_DITENTUKAN",
    "UNASSIGNED_MANDOR roleTitle is MANDOR_BELUM_DITENTUKAN"
  );

  const unassignedItems = await prisma.accExpenseItem.findMany({
    where: {
      picId: unassignedMandor!.id,
      dataScope: DataScope.REAL,
    },
  });
  assert(
    unassignedItems.length === 723,
    `All 723 fallback items are assigned to UNASSIGNED_MANDOR (found ${unassignedItems.length})`
  );

  const unassignedStatusCount = await prisma.accExpenseItem.count({
    where: {
      assignmentStatus: PicAssignmentStatus.UNASSIGNED_MANDOR,
      dataScope: DataScope.REAL,
    },
  });
  assert(
    unassignedStatusCount === 723,
    `Exactly 723 real items have assignmentStatus = UNASSIGNED_MANDOR (found ${unassignedStatusCount})`
  );

  const unassignedTotalAmt = unassignedItems.reduce((sum, item) => sum + Number(item.approvedAmount), 0);
  assert(
    unassignedTotalAmt === 2850378038,
    `UNASSIGNED_MANDOR total amount is Rp2.850.378.038 (Rp2.850.637.788 - Rp259.750), found ${unassignedTotalAmt}`
  );

  // ----------------------------------------------------
  // TEST 3: Explicit Field PIC (PA HERI, etc.) remain intact
  // ----------------------------------------------------
  console.log("--- TEST 3: Explicit Field PICs Retained with Evidence ---");
  const fieldPics = await prisma.fieldPic.findMany({
    where: {
      name: { in: ["PA HERI", "PA DEDI", "PA MAMAT", "PA AGUS", "PA UDEN"] },
    },
  });
  assert(fieldPics.length === 5, "All 5 authentic field mandors exist");
  for (const pic of fieldPics) {
    assert(
      pic.roleTitle !== "ADMINISTRATIVE_SUBMITTER" && !!pic.roleTitle,
      `${pic.name} roleTitle is field personnel role (${pic.roleTitle})`
    );
  }

  const explicitMandorItems = await prisma.accExpenseItem.findMany({
    where: {
      picId: { in: fieldPics.map((p) => p.id) },
      dataScope: DataScope.REAL,
    },
  });
  assert(
    explicitMandorItems.length === 304,
    `Explicit mandor items count is exactly 304, found ${explicitMandorItems.length}`
  );
  for (const item of explicitMandorItems) {
    assert(
      item.assignmentStatus === PicAssignmentStatus.ASSIGNED,
      `Item ${item.noKas} has assignmentStatus = ASSIGNED`
    );
  }

  // ----------------------------------------------------
  // TEST 4: Administrative Submitter dapat diketahui secara terpisah
  // ----------------------------------------------------
  console.log("--- TEST 4: Administrative Submitter on Batches ---");
  const realBatches = await prisma.submissionBatch.findMany({
    where: { dataScope: DataScope.REAL },
  });
  assert(realBatches.length === 379, `379 real batches identified (found ${realBatches.length})`);
  const nisaSubmittedBatches = realBatches.filter((b) => b.administrativeSubmitter === "NISA");
  assert(
    nisaSubmittedBatches.length === 379,
    `All 379 real batches preserve administrativeSubmitter = 'NISA'`
  );

  // ----------------------------------------------------
  // TEST 5: TEST batch tidak masuk operational dashboard
  // ----------------------------------------------------
  console.log("--- TEST 5: TEST Batches Excluded from Operational Dashboard ---");
  const dashboardStats = await getDashboardStats(DataScope.REAL);
  assert(
    dashboardStats.totalBatches === 379,
    `Dashboard total batches is 379 (REAL only, excludes 25 test batches, found ${dashboardStats.totalBatches})`
  );
  assert(
    dashboardStats.totalAccItems === 1028,
    `Dashboard total ACC items is 1,028 (REAL only, excludes 50 test items, found ${dashboardStats.totalAccItems})`
  );
  assert(
    dashboardStats.totalAccAmount === 4303052418,
    `Dashboard total ACC amount is Rp4.303.052.418 (REAL only, excludes Rp271.674.248 test amount, found ${dashboardStats.totalAccAmount})`
  );

  // ----------------------------------------------------
  // TEST 6: TEST disbursement tidak mempengaruhi operational cash
  // ----------------------------------------------------
  console.log("--- TEST 6: Operational Cash Balance Excludes TEST Data ---");
  const realBalances = await getCashBalances(DataScope.REAL);
  assert(
    realBalances.accounts.every((a) => a.totalDisbursement === 0 && a.totalInflow === 0),
    "Operational cash has exactly 0 disbursements and 0 inflows from TEST data"
  );
  assert(
    realBalances.totalLiquidity === 0,
    `Operational cash balance is Rp0 (uncontaminated by TEST funds, found ${realBalances.totalLiquidity})`
  );

  const allBalances = await getCashBalances("ALL");
  const totalInflowsAgg = await prisma.fundInflow.aggregate({
    where: { status: TransactionStatus.POSTED },
    _sum: { amount: true },
  });
  const totalDisbAgg = await prisma.disbursement.aggregate({
    where: { status: TransactionStatus.POSTED },
    _sum: { totalRealizedAmount: true },
  });
  const expectedAllBalance =
    Number(totalInflowsAgg._sum.amount ?? 0) -
    Number(totalDisbAgg._sum.totalRealizedAmount ?? 0);
  assert(
    allBalances.totalLiquidity === expectedAllBalance,
    `When including test scope ('ALL'), liquidity strictly matches total test inflows minus test disbursements (Rp${allBalances.totalLiquidity.toLocaleString("id-ID")})`
  );

  // ----------------------------------------------------
  // TEST 7: TEST journal tidak masuk operational journal report
  // ----------------------------------------------------
  console.log("--- TEST 7: Operational Journal Excludes TEST Journals ---");
  const journalReportReal = await getJournalReport({ dataScope: "REAL" });
  assert(
    journalReportReal.rows.length === 0,
    `Operational journal report contains 0 TEST journal rows (found ${journalReportReal.rows.length})`
  );
  const journalReportAll = await getJournalReport({ dataScope: "ALL" });
  assert(
    journalReportAll.rows.length > 0,
    `All test journals appear under ALL scope (found ${journalReportAll.rows.length} rows)`
  );
  // Verify with DB query that all TEST journals in DB have dataScope = TEST
  const testJournalsCount = await prisma.journalEntry.count({
    where: {
      dataScope: DataScope.TEST,
      status: TransactionStatus.POSTED,
    },
  });
  assert(testJournalsCount > 0, `TEST journals are correctly tagged in DB (found ${testJournalsCount})`);

  // ----------------------------------------------------
  // TEST 8: REAL batch tetap masuk operational reporting
  // ----------------------------------------------------
  console.log("--- TEST 8: REAL Batches Included in Operational Reporting ---");
  const accReport = await getAccReport({ dataScope: "REAL" });
  assert(
    accReport.totals.count === 1028,
    `Operational ACC report includes 1,028 real items (found ${accReport.totals.count})`
  );
  assert(
    accReport.totals.totalApproved === 4303052418,
    `Operational ACC report approved amount is Rp4.303.052.418 (found ${accReport.totals.totalApproved})`
  );

  // ----------------------------------------------------
  // TEST 9: Rp34.299.517 tidak otomatis menjadi POSTED disbursement
  // ----------------------------------------------------
  console.log("--- TEST 9: Rp34.299.517 Held in PENDING_CONFIRMATION ---");
  const candidateRealizationVouchers = ["KT.26.180", "KT.26.214", "KT.26.652"];
  const candidateDisbursements = await prisma.disbursementItem.findMany({
    where: {
      accItem: {
        noKas: { in: candidateRealizationVouchers },
      },
      disbursement: {
        status: TransactionStatus.POSTED,
      },
    },
  });
  assert(
    candidateDisbursements.length === 0,
    `Zero posted disbursements created for candidate realization Rp34.299.517 (found ${candidateDisbursements.length})`
  );

  // ----------------------------------------------------
  // TEST 10: Candidate projects have REQUIRES_BUSINESS_CONFIRMATION
  // ----------------------------------------------------
  console.log("--- TEST 10: 6 Candidate Projects Confirmation Status ---");
  const candidateCodes = ["DARUL_ULUM", "BUDI_INDAH", "APARTEMEN", "ANTAPANI", "CIREBON", "JL_GITAR"];
  const candidateProjects = await prisma.project.findMany({
    where: { code: { in: candidateCodes } },
  });
  assert(candidateProjects.length === 6, `All 6 candidate projects found (found ${candidateProjects.length})`);
  for (const proj of candidateProjects) {
    assert(
      proj.confirmationStatus === ProjectConfirmationStatus.REQUIRES_BUSINESS_CONFIRMATION,
      `Project ${proj.code} confirmationStatus = REQUIRES_BUSINESS_CONFIRMATION`
    );
    assert(
      proj.possibleParentCode === "INTERNAL",
      `Project ${proj.code} possibleParentCode = 'INTERNAL'`
    );
  }

  // ----------------------------------------------------
  // TEST 11: Existing real financial amounts tidak berubah
  // ----------------------------------------------------
  console.log("--- TEST 11: Financial Amounts Immutability ---");
  const realItemsAgg = await prisma.accExpenseItem.aggregate({
    where: { dataScope: DataScope.REAL },
    _sum: { approvedAmount: true },
  });
  assert(
    Number(realItemsAgg._sum.approvedAmount) === 4303052418,
    `SUM(approvedAmount) for real items is unchanged at Rp4.303.052.418 (found ${Number(realItemsAgg._sum.approvedAmount)})`
  );

  // ----------------------------------------------------
  // TEST 12: No Kas tetap unique dan tidak berubah
  // ----------------------------------------------------
  console.log("--- TEST 12: No Kas Voucher Integrity ---");
  const uniqueRealNoKas = await prisma.accExpenseItem.groupBy({
    by: ["noKas"],
    where: { dataScope: DataScope.REAL },
  });
  assert(
    uniqueRealNoKas.length === 379,
    `379 unique real No Kas voucher codes preserved (found ${uniqueRealNoKas.length})`
  );

  // ----------------------------------------------------
  // TEST 13: Source provenance tetap tersedia
  // ----------------------------------------------------
  console.log("--- TEST 13: Source Provenance Traceability ---");
  const itemsWithProvenance = await prisma.accExpenseItem.count({
    where: {
      dataScope: DataScope.REAL,
      notes: { startsWith: "Sumber Excel:" },
    },
  });
  assert(
    itemsWithProvenance === 1028,
    `All 1,028 real items retain full Excel provenance in notes (found ${itemsWithProvenance})`
  );

  // ----------------------------------------------------
  // TEST 14: Debit = Credit tetap balance
  // ----------------------------------------------------
  console.log("--- TEST 14: Balanced Double-Entry Journal Invariant ---");
  const allJournals = await prisma.journalEntry.findMany({
    where: { status: TransactionStatus.POSTED },
    include: { lines: true },
  });
  assert(allJournals.length > 0, "Posted journal entries exist");
  for (const jrn of allJournals) {
    const totalDebit = jrn.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = jrn.lines.reduce((s, l) => s + Number(l.credit), 0);
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;
    assert(
      roundedDebit === roundedCredit,
      `Journal ${jrn.journalNumber} balanced: Debit ${roundedDebit} == Credit ${roundedCredit}`
    );
  }

  // ----------------------------------------------------
  // TEST 15: Existing Financial Invariants tetap PASS
  // ----------------------------------------------------
  console.log("--- TEST 15: Global Financial Invariants Check ---");
  // 1. Positive cash balance
  for (const bal of realBalances.accounts) {
    assert(
      bal.currentBalance >= 0,
      `Cash account ${bal.accountName} balance >= 0 (Rp${bal.currentBalance.toLocaleString("id-ID")})`
    );
  }

  // 2. Realized <= Approved for all items
  const allRealItems = await prisma.accExpenseItem.findMany({
    where: { dataScope: DataScope.REAL },
    include: {
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
      },
    },
  });
  for (const it of allRealItems) {
    const itemRealized = it.disbursementItems.reduce((s, d) => s + Number(d.realizedAmount), 0);
    const itemApproved = Number(it.approvedAmount);
    assert(
      itemRealized <= itemApproved,
      `Item ${it.noKas} realized (${itemRealized}) <= approved (${itemApproved})`
    );
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n==================================================================");
  console.log(`PHASE 8C.2 TEST RESULTS: ${stats.passed} / ${stats.total} PASSED`);
  if (stats.failed > 0) {
    console.error(`FAILED: ${stats.failed} tests`);
    process.exit(1);
  } else {
    console.log("ALL 15 BUSINESS CONFIRMATION & ISOLATION TESTS PASSED!");
  }
  console.log("==================================================================\n");
}

if (require.main === module) {
  runPhase8C2BusinessConfirmationTests()
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
