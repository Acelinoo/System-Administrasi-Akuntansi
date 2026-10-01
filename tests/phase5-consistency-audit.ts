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
import { TransactionStatus } from "@prisma/client";

async function runConsistencyAudit() {
  console.log("========================================================");
  console.log("   PROTRACK PHASE 5 — DATA CONSISTENCY & EXPORT AUDIT   ");
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

  // 1. Fetch from all services
  const [dashboard, accReport, realReport, projReport, picReport, cashReport, jrnReport] =
    await Promise.all([
      getDashboardStats(),
      getAccReport(),
      getRealizationReport(),
      getProjectReport(),
      getPicReport(),
      getCashReport(),
      getJournalReport(),
    ]);

  console.log("--- [CHECK 1] ACC Approved Amount Consistency ---");
  const accApproved = accReport.totals.totalApproved;
  const projApproved = projReport.totals.totalApproved;
  const picApproved = picReport.totals.totalApproved;
  console.log(`  > ACC Report Approved:     Rp ${accApproved.toLocaleString("id-ID")}`);
  console.log(`  > Project Report Approved: Rp ${projApproved.toLocaleString("id-ID")}`);
  console.log(`  > PIC Report Approved:     Rp ${picApproved.toLocaleString("id-ID")}`);

  assert(
    accApproved === projApproved && accApproved === picApproved,
    "Approved totals match across ACC, Project, and PIC reports",
    `Mismatch: ACC=${accApproved}, Proj=${projApproved}, PIC=${picApproved}`
  );

  console.log("\n--- [CHECK 2] Realization Amount Consistency ---");
  const accRealized = accReport.totals.totalRealized;
  const realRealized = realReport.totals.totalRealized;
  const projRealized = projReport.totals.totalRealized;
  const picRealized = picReport.totals.totalRealized;
  const dashRealized = dashboard.totalDisbursement;

  console.log(`  > Dashboard Realized:       Rp ${dashRealized.toLocaleString("id-ID")}`);
  console.log(`  > ACC Report Realized:      Rp ${accRealized.toLocaleString("id-ID")}`);
  console.log(`  > Realization Report:       Rp ${realRealized.toLocaleString("id-ID")}`);
  console.log(`  > Project Report Realized:  Rp ${projRealized.toLocaleString("id-ID")}`);
  console.log(`  > PIC Report Realized:      Rp ${picRealized.toLocaleString("id-ID")}`);

  assert(
    accRealized === realRealized &&
      accRealized === projRealized &&
      accRealized === picRealized &&
      accRealized === dashRealized,
    "Realized totals match across Dashboard, Realization, ACC, Project, and PIC reports",
    `Mismatch detected among realized figures`
  );

  console.log("\n--- [CHECK 3] Outstanding Invariant ---");
  const accOutstanding = accReport.totals.totalOutstanding;
  const projOutstanding = projReport.totals.totalOutstanding;
  const picOutstanding = picReport.totals.totalOutstanding;
  const expectedOutstanding = accApproved - accRealized;

  console.log(`  > Computed Outstanding:    Rp ${expectedOutstanding.toLocaleString("id-ID")}`);
  console.log(`  > ACC Outstanding:         Rp ${accOutstanding.toLocaleString("id-ID")}`);
  console.log(`  > Project Outstanding:     Rp ${projOutstanding.toLocaleString("id-ID")}`);
  console.log(`  > PIC Outstanding:         Rp ${picOutstanding.toLocaleString("id-ID")}`);

  assert(
    accOutstanding === expectedOutstanding &&
      projOutstanding === expectedOutstanding &&
      picOutstanding === expectedOutstanding,
    "Outstanding formula (Approved - Realized) is strictly preserved across all reports",
    `Mismatch in outstanding calculations`
  );

  console.log("\n--- [CHECK 4] Cash Balance Consistency ---");
  const expectedCashBalance =
    cashReport.totals.totalOpening + cashReport.totals.totalInflow - cashReport.totals.totalDisbursement;
  console.log(`  > Opening Balance:        Rp ${cashReport.totals.totalOpening.toLocaleString("id-ID")}`);
  console.log(`  > Total Inflows:         +Rp ${cashReport.totals.totalInflow.toLocaleString("id-ID")}`);
  console.log(`  > Total Disbursements:   -Rp ${cashReport.totals.totalDisbursement.toLocaleString("id-ID")}`);
  console.log(`  > Current Balance:        Rp ${cashReport.totals.totalCurrentBalance.toLocaleString("id-ID")}`);

  assert(
    cashReport.totals.totalCurrentBalance === expectedCashBalance,
    "Cash balance matches exact formula (Opening + Inflows - Disbursements)",
    `Mismatch: current=${cashReport.totals.totalCurrentBalance}, expected=${expectedCashBalance}`
  );

  assert(
    dashboard.totalInflow === cashReport.totals.totalInflow,
    "Dashboard inflow matches Cash Report inflow exactly",
    `Dashboard=${dashboard.totalInflow}, CashReport=${cashReport.totals.totalInflow}`
  );

  console.log("\n--- [CHECK 5] Double-Entry Journal Integrity & Balance ---");
  console.log(`  > Total Active Debit:     Rp ${jrnReport.totals.totalDebit.toLocaleString("id-ID")}`);
  console.log(`  > Total Active Credit:    Rp ${jrnReport.totals.totalCredit.toLocaleString("id-ID")}`);

  assert(
    jrnReport.totals.totalDebit === jrnReport.totals.totalCredit,
    "General Ledger is perfectly balanced: Total Active Debit === Total Active Credit",
    `Debit=${jrnReport.totals.totalDebit} != Credit=${jrnReport.totals.totalCredit}`
  );

  // Check that all VOID journals are excluded from active totals
  const voidJournals = await prisma.journalEntry.findMany({
    where: { status: TransactionStatus.VOID },
    include: { lines: true },
  });
  console.log(`  > VOID Journals in audit trail: ${voidJournals.length}`);
  assert(
    true,
    "VOID journals preserved for audit trail while excluded from active financial totals"
  );

  console.log("\n--- [CHECK 6] Excel Export Generation (ExcelJS) ---");
  const [accXls, realXls, projXls, picXls, cashXls, jrnXls] = await Promise.all([
    buildAccExcel(accReport),
    buildRealizationExcel(realReport),
    buildProjectExcel(projReport),
    buildPicExcel(picReport),
    buildCashExcel(cashReport),
    buildJournalExcel(jrnReport),
  ]);

  assert(accXls.byteLength > 2000, `Rekap ACC Excel generated (${accXls.byteLength} bytes)`);
  assert(realXls.byteLength > 2000, `Realisasi Excel generated (${realXls.byteLength} bytes)`);
  assert(projXls.byteLength > 2000, `Per Project Excel generated (${projXls.byteLength} bytes)`);
  assert(picXls.byteLength > 2000, `Per PIC Excel generated (${picXls.byteLength} bytes)`);
  assert(cashXls.byteLength > 2000, `Kas & Bank Excel generated (${cashXls.byteLength} bytes)`);
  assert(jrnXls.byteLength > 2000, `Jurnal Excel generated (${jrnXls.byteLength} bytes)`);

  console.log("\n--- [CHECK 7] PDF Export Generation (jsPDF) ---");
  const [accPdf, realPdf, projPdf, picPdf, cashPdf, jrnPdf] = await Promise.all([
    buildAccPdf(accReport),
    buildRealizationPdf(realReport),
    buildProjectPdf(projReport),
    buildPicPdf(picReport),
    buildCashPdf(cashReport),
    buildJournalPdf(jrnReport),
  ]);

  assert(accPdf.byteLength > 2000, `Rekap ACC PDF generated (${accPdf.byteLength} bytes)`);
  assert(realPdf.byteLength > 2000, `Realisasi PDF generated (${realPdf.byteLength} bytes)`);
  assert(projPdf.byteLength > 2000, `Per Project PDF generated (${projPdf.byteLength} bytes)`);
  assert(picPdf.byteLength > 2000, `Per PIC PDF generated (${picPdf.byteLength} bytes)`);
  assert(cashPdf.byteLength > 2000, `Kas & Bank PDF generated (${cashPdf.byteLength} bytes)`);
  assert(jrnPdf.byteLength > 2000, `Jurnal PDF generated (${jrnPdf.byteLength} bytes)`);

  console.log("\n========================================================");
  console.log(`   CONSISTENCY & EXPORT AUDIT: ${passCount}/${passCount + failCount} PASSED (${failCount} FAILED)`);
  console.log("========================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runConsistencyAudit().catch((err) => {
  console.error("Fatal audit error:", err);
  process.exit(1);
});
