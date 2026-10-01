import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { getDashboardStats } from "../src/app/actions/acc.actions";
import { getAccReport } from "../src/lib/reports/acc-report.service";
import { getRealizationReport } from "../src/lib/reports/realization-report.service";
import { getProjectReport } from "../src/lib/reports/project-report.service";
import { getPicReport } from "../src/lib/reports/pic-report.service";
import { getCashReport } from "../src/lib/reports/cash-report.service";
import { getJournalReport } from "../src/lib/reports/journal-report.service";
import {
  buildAccExcel,
  buildRealizationExcel,
  buildProjectExcel,
  buildPicExcel,
} from "../src/lib/export/excel-export.service";
import {
  buildAccPdf,
  buildRealizationPdf,
  buildProjectPdf,
  buildPicPdf,
} from "../src/lib/export/pdf-export.service";
import { createSubmissionBatch } from "../src/lib/finance/acc.service";
import { createFundInflow } from "../src/lib/finance/inflow.service";
import { createDisbursement, voidDisbursement } from "../src/lib/finance/disbursement.service";
import { AccStatus, CashType, PaymentMethod, TransactionStatus } from "@prisma/client";

async function runPhase7E2EConsistencyTest() {
  console.log("========================================================");
  console.log("   PROTRACK PHASE 7 — E2E DATA CONSISTENCY TEST SUITE   ");
  console.log("========================================================\n");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ [PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`  ✖ [FAIL] ${testName} -> ${detail || ""}`);
      failCount++;
    }
  }

  // 1. Get seed references
  const project = await prisma.project.findFirst({ where: { isActive: true } });
  const category = await prisma.expenseCategory.findFirst({ where: { isActive: true } });
  const pic = await prisma.fieldPic.findFirst({ where: { isActive: true } });
  const account = await prisma.cashAccount.findFirst({ where: { isActive: true } });

  if (!project || !category || !pic || !account) {
    throw new Error("Master data missing for test execution.");
  }

  const timestamp = Date.now();
  const testBatchCode = `BATCH-P7-${timestamp}`;
  const testInflowNumber = `IN-P7-${timestamp}`;
  const testDisbNumber = `DISB-P7-${timestamp}`;

  console.log("--- [STEP 1] Setup Test Scenario ACC = Rp 45.292.500 ---");

  // Create ACC Batch with approved amount = 45.292.500
  const accResult = await createSubmissionBatch({
    batchCode: testBatchCode,
    accDate: new Date("2026-10-01"),
    approvedByName: "Pa Giri",
    notes: "Phase 7 E2E Consistency Test Batch",
    items: [
      {
        cashType: CashType.KT,
        projectId: project.id,
        categoryId: category.id,
        picId: pic.id,
        description: "Alokasi Borongan Proyek P7 Consistency",
        approvedAmount: 45292500,
      },
    ],
  });

  const accItem = accResult.items[0];
  assert(accItem !== undefined, "Test ACC item created successfully");
  assert(Number(accItem.approvedAmount) === 45292500, "ACC Item approvedAmount exactly Rp 45.292.500");
  assert(accItem.status === AccStatus.APPROVED, "Initial ACC status is APPROVED");

  // Drop dana inflow: Rp 60.000.000 to ensure liquidity
  const inflowResult = await createFundInflow({
    inflowNumber: testInflowNumber,
    inflowDate: new Date("2026-10-01"),
    destinationAccountId: account.id,
    amount: 60000000,
    sourceInfo: "Dropping Dana Proyek P7",
    referenceNo: `REF-P7-${timestamp}`,
  });
  assert(inflowResult.status === TransactionStatus.POSTED, "Fund Inflow Rp 60.000.000 posted");

  console.log("\n--- [STEP 2] Execute Partial Disbursement = Rp 25.292.500 ---");

  const disbResult = await createDisbursement({
    disbursementNumber: testDisbNumber,
    disbursementDate: new Date("2026-10-02"),
    cashAccountId: account.id,
    paymentMethod: PaymentMethod.TRANSFER,
    totalRealizedAmount: 25292500,
    items: [
      {
        accItemId: accItem.id,
        realizedAmount: 25292500,
      },
    ],
    notes: "Pencairan Tahap 1 Borongan Proyek P7",
  });

  assert(disbResult.disbursement.status === TransactionStatus.POSTED, "Disbursement voucher posted");
  assert(Number(disbResult.disbursement.totalRealizedAmount) === 25292500, "Disbursement total matches Rp 25.292.500");

  console.log("\n--- [STEP 3] Check ACC Detail Invariant ---");

  const updatedAcc = await prisma.accExpenseItem.findUnique({
    where: { id: accItem.id },
    include: {
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
      },
    },
  });

  const realizedSum = updatedAcc!.disbursementItems.reduce((s, di) => s + Number(di.realizedAmount), 0);
  const outstandingSum = Math.max(0, Number(updatedAcc!.approvedAmount) - realizedSum);

  assert(updatedAcc!.status === AccStatus.PARTIALLY_REALIZED, "ACC status updated to PARTIALLY_REALIZED");
  assert(Number(updatedAcc!.approvedAmount) === 45292500, "ACC Detail: Approved = Rp 45.292.500");
  assert(realizedSum === 25292500, "ACC Detail: Realized = Rp 25.292.500");
  assert(outstandingSum === 20000000, "ACC Detail: Outstanding = Rp 20.000.000");

  console.log("\n--- [STEP 4] Cross-Module Consistency Across Reports & Dashboard ---");

  const [dashboard, accReport, realReport, projReport, picReport, journalReport] = await Promise.all([
    getDashboardStats("ALL"),
    getAccReport({ projectId: project.id, dataScope: "ALL" }),
    getRealizationReport({ projectId: project.id, dataScope: "ALL" }),
    getProjectReport({ projectId: project.id, dataScope: "ALL" }),
    getPicReport({ picId: pic.id, dataScope: "ALL" }),
    getJournalReport({ dataScope: "ALL" }),
  ]);

  // Find the item in ACC report
  const itemInReport = accReport.items.find((i) => i.id === accItem.id);
  assert(itemInReport !== undefined, "Test item found in ACC Report query");
  assert(itemInReport?.approvedAmount === 45292500, "ACC Report item approved = Rp 45.292.500");
  assert(itemInReport?.realizedAmount === 25292500, "ACC Report item realized = Rp 25.292.500");
  assert(itemInReport?.outstandingAmount === 20000000, "ACC Report item outstanding = Rp 20.000.000");

  // Check Dashboard calculations
  assert(dashboard.totalAccAmount >= 45292500, "Dashboard Total ACC reflects approved amount");
  assert(dashboard.totalRealizedAmount >= 25292500, "Dashboard Total Realized reflects realized amount");
  assert(dashboard.totalOutstandingAmount >= 20000000, "Dashboard Total Outstanding reflects outstanding amount");
  assert(
    dashboard.totalOutstandingAmount === dashboard.totalAccAmount - dashboard.totalRealizedAmount,
    "Dashboard invariant holds: Outstanding === Total ACC - Total Realisasi"
  );

  // Check Realization Report
  const realItem = realReport.items.find((i) => i.noKas === accItem.noKas);
  assert(realItem !== undefined, "Test voucher found in Realization Report");
  assert(realItem?.realizedAmount === 25292500, "Realization Report item = Rp 25.292.500");

  // Check Project Report consistency
  const projSummary = projReport.projects.find((p) => p.projectId === project.id);
  assert(projSummary !== undefined, "Project found in Project Report");
  assert(projSummary!.approvedAmount >= 45292500, "Project Report Approved includes Rp 45.292.500");
  assert(projSummary!.realizedAmount >= 25292500, "Project Report Realized includes Rp 25.292.500");
  assert(projSummary!.outstandingAmount >= 20000000, "Project Report Outstanding includes Rp 20.000.000");
  assert(
    projSummary!.outstandingAmount === projSummary!.approvedAmount - projSummary!.realizedAmount,
    "Project Report invariant holds: Outstanding === Approved - Realized"
  );

  // Check PIC Report consistency
  const picSummary = picReport.pics.find((p) => p.picId === pic.id);
  assert(picSummary !== undefined, "PIC found in PIC Report");
  assert(picSummary!.approvedAmount >= 45292500, "PIC Report Approved includes Rp 45.292.500");
  assert(picSummary!.realizedAmount >= 25292500, "PIC Report Realized includes Rp 25.292.500");
  assert(picSummary!.outstandingAmount >= 20000000, "PIC Report Outstanding includes Rp 20.000.000");
  assert(
    picSummary!.outstandingAmount === picSummary!.approvedAmount - picSummary!.realizedAmount,
    "PIC Report invariant holds: Outstanding === Approved - Realized"
  );

  console.log("\n--- [STEP 5] Double-Entry Journal Integrity ---");

  const disbJournals = await prisma.journalEntry.findMany({
    where: { sourceId: disbResult.disbursement.id },
    include: { lines: true },
  });

  assert(disbJournals.length === 1, "Exactly one Journal Entry generated for disbursement");
  const journal = disbJournals[0];
  const debitTotal = journal.lines.reduce((s, l) => s + Number(l.debit), 0);
  const creditTotal = journal.lines.reduce((s, l) => s + Number(l.credit), 0);

  assert(debitTotal === 25292500, "Journal Debit total matches Rp 25.292.500");
  assert(creditTotal === 25292500, "Journal Credit total matches Rp 25.292.500");
  assert(debitTotal === creditTotal, "Journal is strictly balanced: Total Debit === Total Credit");

  console.log("\n--- [STEP 6] Excel & PDF Export Usability Verification ---");

  const [excelBuf, pdfBuf] = await Promise.all([
    buildAccExcel(accReport),
    buildAccPdf(accReport),
  ]);

  assert(excelBuf.length > 0, `Excel export generated successfully (${excelBuf.length} bytes)`);
  assert(pdfBuf.length > 0, `PDF export generated successfully (${pdfBuf.length} bytes)`);

  console.log("\n--- [STEP 7] VOID & Reversal Lifecycle Check ---");

  // VOID the disbursement
  await voidDisbursement(
    disbResult.disbursement.id,
    "Pembatalan untuk testing E2E consistency"
  );

  const voidedDisb = await prisma.disbursement.findUnique({
    where: { id: disbResult.disbursement.id },
  });
  assert(voidedDisb?.status === TransactionStatus.VOID, "Disbursement status updated to VOID");

  const postVoidAcc = await prisma.accExpenseItem.findUnique({
    where: { id: accItem.id },
    include: {
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
      },
    },
  });

  const postVoidRealized = postVoidAcc!.disbursementItems.reduce((s, di) => s + Number(di.realizedAmount), 0);
  const postVoidOutstanding = Math.max(0, Number(postVoidAcc!.approvedAmount) - postVoidRealized);

  assert(postVoidAcc?.status === AccStatus.APPROVED, "ACC status restored to APPROVED after VOID");
  assert(postVoidRealized === 0, "Realized amount reset to Rp 0");
  assert(postVoidOutstanding === 45292500, "Outstanding amount restored to full Rp 45.292.500");

  const voidedJournal = await prisma.journalEntry.findFirst({
    where: { sourceId: disbResult.disbursement.id },
  });
  assert(voidedJournal?.status === TransactionStatus.VOID, "Associated journal entry marked as VOID");

  console.log("\n--- [STEP 8] Cleanup Test Data ---");

  // Clean up journal lines and entries
  await prisma.journalLine.deleteMany({
    where: { journal: { sourceId: { in: [disbResult.disbursement.id, inflowResult.id] } } },
  });
  await prisma.journalEntry.deleteMany({
    where: { sourceId: { in: [disbResult.disbursement.id, inflowResult.id] } },
  });

  // Clean up disbursement
  await prisma.disbursementItem.deleteMany({ where: { disbursementId: disbResult.disbursement.id } });
  await prisma.disbursement.delete({ where: { id: disbResult.disbursement.id } });

  // Clean up inflow
  await prisma.fundInflow.delete({ where: { id: inflowResult.id } });

  // Clean up ACC
  await prisma.accExpenseItem.delete({ where: { id: accItem.id } });
  await prisma.submissionBatch.delete({ where: { id: accResult.batch.id } });

  console.log("  ✔ [PASS] Test records cleaned up successfully\n");

  console.log("========================================================");
  console.log(`   E2E CONSISTENCY RESULTS: ${passCount}/${passCount + failCount} PASSED (${failCount} FAILED)`);
  console.log("========================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase7E2EConsistencyTest().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
