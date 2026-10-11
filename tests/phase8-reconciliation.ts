import { prisma } from "../src/lib/db/prisma";
import { getDashboardStats } from "../src/app/actions/acc.actions";
import { getAllCashBalances } from "../src/lib/finance/balance.service";
import { getProjectReport } from "../src/lib/reports/project-report.service";
import { getCashReport } from "../src/lib/reports/cash-report.service";
import { getJournalReport } from "../src/lib/reports/journal-report.service";
import { getAccReport } from "../src/lib/reports/acc-report.service";
import { getRealizationReport } from "../src/lib/reports/realization-report.service";
import { getPicReport } from "../src/lib/reports/pic-report.service";
import { createFundInflow, voidFundInflow } from "../src/lib/finance/inflow.service";
import { createDisbursement, voidDisbursement } from "../src/lib/finance/disbursement.service";
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
import { DataScope, TransactionStatus, PaymentMethod } from "@prisma/client";

async function runPhase8ReconciliationSuite() {
  console.log("===================================================================");
  console.log("   PROTRACK PHASE 8 — DASHBOARD, FINANCIAL REPORTS & RECONCILIATION");
  console.log("===================================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✔ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ✖ [FAIL] ${testName} -> ${detail || ""}`);
      failedTests++;
    }
  }

  // Pre-test: Record initial baseline
  const [initialBatches, initialItems, initialApprovedAgg, initialDisb, initialJournals] =
    await Promise.all([
      prisma.submissionBatch.count({ where: { dataScope: DataScope.REAL } }),
      prisma.accExpenseItem.count({ where: { dataScope: DataScope.REAL } }),
      prisma.accExpenseItem.aggregate({
        where: { dataScope: DataScope.REAL },
        _sum: { approvedAmount: true },
      }),
      prisma.disbursement.count({ where: { dataScope: DataScope.REAL } }),
      prisma.journalEntry.count({ where: { dataScope: DataScope.REAL } }),
    ]);

  const initialApproved = Number(initialApprovedAgg._sum.approvedAmount ?? 0);
  console.log("--- [PRE-CHECK] REAL Invariant Baseline Verification ---");
  console.log(`  > Batches:       ${initialBatches} (Target: 379)`);
  console.log(`  > ACC Items:     ${initialItems} (Target: 1028)`);
  console.log(`  > Approved:      Rp ${initialApproved.toLocaleString("id-ID")} (Target: 4303052418)`);
  console.log(`  > Disbursements: ${initialDisb} (Target: 0)`);
  console.log(`  > Journals:      ${initialJournals} (Target: 0)\n`);

  assert(initialBatches === 379, "Baseline REAL batches count is 379");
  assert(initialItems === 1028, "Baseline REAL ACC items count is 1028");
  assert(initialApproved === 4303052418, "Baseline REAL total approved amount is Rp 4.303.052.418");
  assert(initialDisb === 0, "Baseline REAL disbursements count is 0");
  assert(initialJournals === 0, "Baseline REAL journal entries count is 0");

  // SECTION 1: Reconciliation across Dashboard & Reports in REAL scope
  console.log("\n--- [SECTION 1] REAL Scope Multi-Report Reconciliation ---");
  const [dashReal, cashReal, projReal, accReal, realReal, picReal, jrnReal] =
    await Promise.all([
      getDashboardStats("REAL"),
      getCashReport({ dataScope: "REAL" }),
      getProjectReport({ dataScope: "REAL" }),
      getAccReport({ dataScope: "REAL" }),
      getRealizationReport({ dataScope: "REAL" }),
      getPicReport({ dataScope: "REAL" }),
      getJournalReport({ dataScope: "REAL" }),
    ]);

  assert(
    dashReal.totalAccAmount === initialApproved &&
      projReal.totals.totalApproved === initialApproved &&
      accReal.totals.totalApproved === initialApproved &&
      picReal.totals.totalApproved === initialApproved,
    "Approved amount is identical across Dashboard, Project, ACC, and PIC reports",
    `Mismatch: Dash=${dashReal.totalAccAmount}, Proj=${projReal.totals.totalApproved}, ACC=${accReal.totals.totalApproved}`
  );

  assert(
    dashReal.totalRealizedAmount === 0 &&
      cashReal.totals.totalDisbursement === 0 &&
      projReal.totals.totalRealized === 0 &&
      realReal.totals.totalRealized === 0,
    "Zero realized amount invariant in REAL scope across all financial services"
  );

  assert(
    cashReal.totals.totalOpening + cashReal.totals.totalInflow - cashReal.totals.totalDisbursement ===
      cashReal.totals.totalCurrentBalance,
    "Cash & Bank balance equation strictly balances: Opening + Inflow - Disbursement = Current Balance"
  );

  assert(
    jrnReal.totals.totalDebit === 0 && jrnReal.totals.totalCredit === 0,
    "Zero journal entries in REAL scope and balanced debit/credit"
  );

  // SECTION 2: TEST Scope Isolated Mutation, Reconciliation, and VOID Lifecycle
  console.log("\n--- [SECTION 2] TEST Scope Transaction Lifecycle & Reconciliation ---");

  // Fetch reference master entities
  const [activeAccount, activeProject, activeCategory, activePic] = await Promise.all([
    prisma.cashAccount.findFirst({ where: { isActive: true, accountType: "BANK" } }),
    prisma.project.findFirst({ where: { isActive: true } }),
    prisma.expenseCategory.findFirst({ where: { isActive: true } }),
    prisma.fieldPic.findFirst({ where: { isActive: true } }),
  ]);

  if (!activeAccount || !activeProject || !activeCategory || !activePic) {
    throw new Error("Master reference data not found for running TEST suite");
  }

  // Create isolated TEST Batch & Item
  const testBatch = await prisma.submissionBatch.create({
    data: {
      batchCode: `TEST-PH8-BATCH-${Date.now()}`,
      accDate: new Date(),
      dataScope: DataScope.TEST,
      administrativeSubmitter: "PHASE8-TESTER",
      approvedByName: "Pak Giri (TEST)",
    },
  });

  const testItem = await prisma.accExpenseItem.create({
    data: {
      batchId: testBatch.id,
      itemNo: 9901,
      noKas: `KT.TEST.PH8.${Date.now() % 10000}`,
      cashType: "KT",
      projectId: activeProject.id,
      categoryId: activeCategory.id,
      picId: activePic.id,
      description: "Test Material Pembelian Semen Phase 8",
      approvedAmount: 15000000, // Rp 15.000.000
      status: "APPROVED",
      dataScope: DataScope.TEST,
    },
  });

  console.log(`  > Created TEST Item: ${testItem.noKas} (Approved: Rp 15.000.000)`);

  // Step 2A: Fund Inflow (Dropping Dana Masuk Rp 50.000.000)
  const inflowResult = await createFundInflow({
    inflowDate: new Date(),
    destinationAccountId: activeAccount.id,
    sourceInfo: "Dropping Manajemen Pusat (TEST)",
    amount: 50000000,
    projectId: activeProject.id,
    dataScope: DataScope.TEST,
  });

  console.log(`  > Created TEST Inflow: Rp 50.000.000 (No: ${inflowResult.inflowNumber})`);

  // Check Inflow & Cash Balance in TEST scope
  const cashTestAfterInflow = await getCashReport({ dataScope: "TEST" });
  const dashTestAfterInflow = await getDashboardStats("TEST");
  const jrnTestAfterInflow = await getJournalReport({ dataScope: "TEST" });

  assert(
    dashTestAfterInflow.totalInflow >= 50000000,
    "Dashboard TEST scope reflects POSTED inflow"
  );
  assert(
    cashTestAfterInflow.totals.totalInflow >= 50000000,
    "Cash report TEST scope reflects POSTED inflow"
  );
  assert(
    jrnTestAfterInflow.totals.totalDebit === jrnTestAfterInflow.totals.totalCredit,
    "Journal entry for Fund Inflow is double-entry balanced (Debit === Credit)"
  );

  // Step 2B: Disbursement (Pencairan Tahap 1 Rp 9.000.000)
  const disbCreateRes = await createDisbursement({
    disbursementDate: new Date(),
    cashAccountId: activeAccount.id,
    paymentMethod: PaymentMethod.TRANSFER,
    totalRealizedAmount: 9000000,
    dataScope: DataScope.TEST,
    notes: "Pencairan Tahap 1 Semen Phase 8",
    items: [
      {
        accItemId: testItem.id,
        realizedAmount: 9000000,
      },
    ],
  });
  const disbResult = disbCreateRes.disbursement;

  console.log(`  > Created TEST Disbursement: Rp 9.000.000 (Voucher: ${disbResult.disbursementNumber})`);

  // Verify multi-module reconciliation after disbursement
  const [dashTestAfterDisb, cashTestAfterDisb, projTestAfterDisb, jrnTestAfterDisb] =
    await Promise.all([
      getDashboardStats("TEST"),
      getCashReport({ dataScope: "TEST" }),
      getProjectReport({ dataScope: "TEST" }),
      getJournalReport({ dataScope: "TEST" }),
    ]);

  assert(
    dashTestAfterDisb.totalRealizedAmount >= 9000000,
    "Dashboard reflects POSTED disbursement amount"
  );
  assert(
    cashTestAfterDisb.totals.totalDisbursement >= 9000000,
    "Cash report reflects POSTED disbursement outflow"
  );
  assert(
    cashTestAfterDisb.totals.totalOpening +
      cashTestAfterDisb.totals.totalInflow -
      cashTestAfterDisb.totals.totalDisbursement ===
      cashTestAfterDisb.totals.totalCurrentBalance,
    "Cash report balance remains strictly reconciled after disbursement"
  );
  assert(
    jrnTestAfterDisb.totals.totalDebit === jrnTestAfterDisb.totals.totalCredit,
    "Journal entries for Inflow + Disbursement remain strictly balanced"
  );

  // Verify item status in TEST
  const itemAfterDisb = await prisma.accExpenseItem.findUnique({
    where: { id: testItem.id },
  });
  assert(
    itemAfterDisb?.status === "PARTIALLY_REALIZED",
    "ACC item transitioned to PARTIALLY_REALIZED after partial payment (9m of 15m)"
  );

  // Step 2C: VOID Lifecycle Test
  console.log("\n--- [SECTION 3] VOID Lifecycle & Reversal Reconciliation ---");
  await voidDisbursement(disbResult.id, "Batal pengujian UAT Phase 8");
  console.log(`  > Successfully VOIDED Disbursement: ${disbResult.disbursementNumber}`);

  const [dashTestAfterVoid, cashTestAfterVoid, jrnTestAfterVoid] = await Promise.all([
    getDashboardStats("TEST"),
    getCashReport({ dataScope: "TEST" }),
    getJournalReport({ dataScope: "TEST", status: "POSTED" }),
  ]);

  assert(
    dashTestAfterVoid.totalRealizedAmount === 0,
    "VOID disbursement is completely excluded from Dashboard realized amount"
  );
  assert(
    cashTestAfterVoid.totals.totalDisbursement === 0,
    "VOID disbursement is completely excluded from Cash Report disbursement total"
  );
  assert(
    jrnTestAfterVoid.totals.totalDebit === jrnTestAfterVoid.totals.totalCredit,
    "POSTED journals remain strictly balanced after voiding disbursement"
  );

  const itemAfterVoid = await prisma.accExpenseItem.findUnique({
    where: { id: testItem.id },
  });
  assert(
    itemAfterVoid?.status === "APPROVED",
    "ACC item status safely rolled back to APPROVED after voiding disbursement"
  );

  // Step 2D: Void Fund Inflow as well
  await voidFundInflow(inflowResult.id, "Batal inflow pengujian Phase 8");
  console.log(`  > Successfully VOIDED Inflow: ${inflowResult.inflowNumber}`);

  const cashTestAfterVoidInflow = await getCashReport({ dataScope: "TEST" });
  assert(
    cashTestAfterVoidInflow.totals.totalInflow === 0,
    "VOID inflow is completely excluded from Cash Report inflow total"
  );

  // SECTION 4: Export Engine Test with Scope Metadata & Test Tag
  console.log("\n--- [SECTION 4] Export Engine Audit (Excel & PDF) ---");
  const [accExcel, realExcel, projExcel, picExcel, cashExcel, jrnExcel] = await Promise.all([
    buildAccExcel(accReal),
    buildRealizationExcel(realReal),
    buildProjectExcel(projReal),
    buildPicExcel(picReal),
    buildCashExcel(cashReal),
    buildJournalExcel(jrnReal),
  ]);

  assert(accExcel.byteLength > 1000, "Excel ACC report generated valid bytes");
  assert(realExcel.byteLength > 1000, "Excel Realization report generated valid bytes");
  assert(projExcel.byteLength > 1000, "Excel Project report generated valid bytes");
  assert(picExcel.byteLength > 1000, "Excel PIC report generated valid bytes");
  assert(cashExcel.byteLength > 1000, "Excel Cash & Bank report generated valid bytes");
  assert(jrnExcel.byteLength > 1000, "Excel Journal report generated valid bytes");

  const [accPdf, realPdf, projPdf, picPdf, cashPdf, jrnPdf] = await Promise.all([
    buildAccPdf(accReal),
    buildRealizationPdf(realReal),
    buildProjectPdf(projReal),
    buildPicPdf(picReal),
    buildCashPdf(cashReal),
    buildJournalPdf(jrnReal),
  ]);

  assert(accPdf.byteLength > 1000, "PDF ACC report generated valid bytes");
  assert(realPdf.byteLength > 1000, "PDF Realization report generated valid bytes");
  assert(projPdf.byteLength > 1000, "PDF Project report generated valid bytes");
  assert(picPdf.byteLength > 1000, "PDF PIC report generated valid bytes");
  assert(cashPdf.byteLength > 1000, "PDF Cash & Bank report generated valid bytes");
  assert(jrnPdf.byteLength > 1000, "PDF Journal report generated valid bytes");

  // SECTION 5: Cleanup of TEST Artifacts
  console.log("\n--- [SECTION 5] Test Cleanup & Final Invariant Validation ---");
  // Clean up journals
  await prisma.journalLine.deleteMany({
    where: {
      journal: {
        sourceId: { in: [disbResult.id, inflowResult.id] },
      },
    },
  });
  await prisma.journalEntry.deleteMany({
    where: {
      sourceId: { in: [disbResult.id, inflowResult.id] },
    },
  });
  // Clean up disbursement items and disbursement
  await prisma.disbursementItem.deleteMany({ where: { disbursementId: disbResult.id } });
  await prisma.disbursement.deleteMany({ where: { id: disbResult.id } });
  // Clean up inflow
  await prisma.fundInflow.deleteMany({ where: { id: inflowResult.id } });
  // Clean up ACC item & batch
  await prisma.accExpenseItem.deleteMany({ where: { id: testItem.id } });
  await prisma.submissionBatch.deleteMany({ where: { id: testBatch.id } });

  console.log("  ✔ Cleaned up all temporary TEST artifacts.");

  // Final Invariant Check
  const [finalBatches, finalItems, finalApprovedAgg, finalDisb, finalJournals] =
    await Promise.all([
      prisma.submissionBatch.count({ where: { dataScope: DataScope.REAL } }),
      prisma.accExpenseItem.count({ where: { dataScope: DataScope.REAL } }),
      prisma.accExpenseItem.aggregate({
        where: { dataScope: DataScope.REAL },
        _sum: { approvedAmount: true },
      }),
      prisma.disbursement.count({ where: { dataScope: DataScope.REAL } }),
      prisma.journalEntry.count({ where: { dataScope: DataScope.REAL } }),
    ]);

  const finalApproved = Number(finalApprovedAgg._sum.approvedAmount ?? 0);
  console.log("\n--- [FINAL CHECK] REAL Invariant Baseline Verification ---");
  console.log(`  > Batches:       ${finalBatches} (Initial: ${initialBatches})`);
  console.log(`  > ACC Items:     ${finalItems} (Initial: ${initialItems})`);
  console.log(`  > Approved:      Rp ${finalApproved.toLocaleString("id-ID")} (Initial: ${initialApproved})`);
  console.log(`  > Disbursements: ${finalDisb} (Initial: 0)`);
  console.log(`  > Journals:      ${finalJournals} (Initial: 0)\n`);

  assert(finalBatches === 379, "Final REAL batches count is strictly 379");
  assert(finalItems === 1028, "Final REAL ACC items count is strictly 1028");
  assert(finalApproved === 4303052418, "Final REAL total approved amount is strictly Rp 4.303.052.418");
  assert(finalDisb === 0, "Final REAL disbursements count is strictly 0");
  assert(finalJournals === 0, "Final REAL journal entries count is strictly 0");

  console.log("\n===================================================================");
  console.log(`   PHASE 8 SUITE FINISHED: ${passedTests}/${totalTests} PASS (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  if (failedTests > 0) {
    console.error(`   STATUS: ${failedTests} TESTS FAILED!`);
    process.exit(1);
  } else {
    console.log("   STATUS: ALL RECONCILIATION & SAFETY INVARIANTS SATISFIED 100%!");
    console.log("===================================================================\n");
  }
}

runPhase8ReconciliationSuite()
  .catch((err) => {
    console.error("FATAL ERROR IN PHASE 8 TEST SUITE:", err);
    process.exit(1);
  });
