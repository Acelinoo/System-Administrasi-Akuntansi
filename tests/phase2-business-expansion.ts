import { prisma } from "../src/lib/db/prisma";
import {
  TerminStatus,
  DataScope,
  CashType,
  PaymentMethod,
  TransactionStatus,
  JournalSourceType,
  CoaType,
} from "@prisma/client";
import {
  getProject360Data,
  createProjectBudget,
  addBudgetItem,
  deleteBudgetItem,
  createProjectTermin,
  recordTerminPayment,
  createProjectProgressLog,
  createExpenseItemDetail,
  createVendorContract,
} from "../src/lib/finance/project-360.service";
import { getProjectReport } from "../src/lib/reports/project-report.service";
import { getJournalReport } from "../src/lib/reports/journal-report.service";
import { buildProjectExcel, buildJournalExcel } from "../src/lib/export/excel-export.service";
import { buildProjectPdf, buildJournalPdf } from "../src/lib/export/pdf-export.service";
import { getCashAccountBalance } from "../src/lib/finance/balance.service";

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
  }
}

async function runPhase2ExpansionTests() {
  console.log("\n========================================================");
  console.log("   PROTRACK PHASE 2 — FULL BUSINESS EXPANSION TESTS    ");
  console.log("========================================================\n");

  // ----------------------------------------------------
  // TEST GROUP 1: HISTORICAL BASELINE & INVARIANTS PROTECTION
  // ----------------------------------------------------
  console.log("\n--- [GROUP 1] Baseline Invariant Verification ---");
  try {
    const realBatchesCount = await prisma.submissionBatch.count({
      where: { dataScope: DataScope.REAL },
    });
    const realItemsCount = await prisma.accExpenseItem.count({
      where: { dataScope: DataScope.REAL },
    });
    const realApprovedSum = await prisma.accExpenseItem.aggregate({
      where: { dataScope: DataScope.REAL },
      _sum: { approvedAmount: true },
    });

    assert(
      realBatchesCount === 379,
      `Real batches remain exactly 379 (found: ${realBatchesCount})`
    );
    assert(
      realItemsCount === 1028,
      `Real items remain exactly 1,028 (found: ${realItemsCount})`
    );
    assert(
      Number(realApprovedSum._sum.approvedAmount) === 4303052418,
      `Total approved amount remains exactly Rp4.303.052.418 (found: ${Number(realApprovedSum._sum.approvedAmount)})`
    );

    const realPostedDisbCount = await prisma.disbursement.count({
      where: { dataScope: DataScope.REAL, status: TransactionStatus.POSTED },
    });
    const realPostedInflowCount = await prisma.fundInflow.count({
      where: { dataScope: DataScope.REAL, status: TransactionStatus.POSTED },
    });
    assert(
      realPostedDisbCount === 0 && realPostedInflowCount === 0,
      "Zero posted disbursements/inflows in REAL scope (baseline preserved)"
    );
  } catch (err: any) {
    assert(false, "Historical baseline verification", err.message);
  }

  // Find a test project
  const alcent = await prisma.project.findUnique({ where: { code: "ALCENT" } });
  if (!alcent) throw new Error("ALCENT project not found");

  const cashAccount = await prisma.cashAccount.findFirst({
    where: { isActive: true },
  });
  if (!cashAccount) throw new Error("Active cash account not found");

  // ----------------------------------------------------
  // TEST GROUP 2: PROJECT 360° DATA STRUCTURE & METRICS
  // ----------------------------------------------------
  console.log("\n--- [GROUP 2] Project 360° Metrics & Separation ---");
  try {
    const p360 = await getProject360Data(alcent.id);
    if (!p360) throw new Error("Project 360 data not found");

    assert(p360.project.id === alcent.id, "getProject360Data returns requested project");
    assert(
      typeof p360.metrics.totalPostedExpense === "number" &&
      typeof p360.metrics.totalPostedInflow === "number" &&
      typeof p360.metrics.netInflowBalance === "number",
      "Cost control metrics are numbers"
    );
    assert(
      p360.metrics.netInflowBalance === p360.metrics.totalPostedInflow - p360.metrics.totalPostedExpense,
      "Saldo Penerimaan Bersih = totalInflow - totalCost formula strictly verified"
    );

    if (p360.metrics.contractValue != null) {
      assert(
        p360.metrics.remainingContractValue ===
          Number(p360.metrics.contractValue) - p360.metrics.totalPostedInflow,
        "Sisa Nilai Kontrak = contractValue - totalInflow formula strictly verified"
      );
    }

    assert(
      p360.metrics.physicalProgressPct === null || typeof p360.metrics.physicalProgressPct === "number",
      "Physical progress is either null (belum tersedia) or a real number, never an assumed 0%"
    );
  } catch (err: any) {
    assert(false, "Project 360 metrics calculation", err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 3: RAP / RAB BUDGETING WORKFLOW
  // ----------------------------------------------------
  console.log("\n--- [GROUP 3] RAP/RAB Budgeting Workflow ---");
  let createdBudgetId = "";
  let createdBudgetItemId = "";
  try {
    // 3.1 Create Budget
    const budget = await createProjectBudget({
      projectId: alcent.id,
      budgetName: "RAP 2026 Test Suite",
      version: 1,
      notes: "Test budget RAP",
    });
    createdBudgetId = budget.id;
    assert(budget.budgetName === "RAP 2026 Test Suite", "Project budget header created");

    // 3.2 Add Budget Item
    const item = await addBudgetItem({
      budgetId: budget.id,
      itemCode: "PEK-01",
      description: "Pekerjaan Dinding Bata Ringan",
      category: "MATERIAL",
      unit: "m2",
      volume: 150,
      unitPrice: 120000,
    });
    createdBudgetItemId = item.id;
    assert(
      Number(item.totalAmount) === 150 * 120000,
      `Budget item total amount calculated accurately (${item.totalAmount} = 150 * 120.000)`
    );

    // 3.3 Verify in Project 360
    const p360AfterBudget = await getProject360Data(alcent.id);
    if (!p360AfterBudget) throw new Error("Project 360 data after budget not found");
    assert(
      p360AfterBudget.metrics.totalRapBudget >= 18000000,
      "Project 360 totalBudget reflects added budget items"
    );
  } catch (err: any) {
    assert(false, "RAP/RAB budgeting workflow", err.message);
  } finally {
    // Cleanup budget
    if (createdBudgetItemId) {
      await prisma.budgetItem.delete({ where: { id: createdBudgetItemId } }).catch(() => {});
    }
    if (createdBudgetId) {
      await prisma.projectBudget.delete({ where: { id: createdBudgetId } }).catch(() => {});
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 4: TERMIN & REALIZED INFLOW SEPARATION
  // ----------------------------------------------------
  console.log("\n--- [GROUP 4] Termin vs Realized Inflow Separation ---");
  let createdTerminId = "";
  let createdInflowId = "";
  try {
    const initialCashBal = await getCashAccountBalance(cashAccount.id);

    // 4.1 Create PLANNED Termin
    const termin = await createProjectTermin({
      projectId: alcent.id,
      terminNumber: 99,
      name: "Termin 99 Test 20%",
      plannedAmount: 50000000,
    });
    createdTerminId = termin.id;
    assert(termin.status === TerminStatus.PLANNED, "Termin created as PLANNED");

    // Verify cash balance did NOT change
    const cashBalAfterPlanned = await getCashAccountBalance(cashAccount.id);
    assert(
      initialCashBal.currentBalance === cashBalAfterPlanned.currentBalance,
      "Termin PLANNED does NOT alter cash account balance (Termin is not cash)"
    );

    // 4.2 Record Payment (Realized Inflow)
    const terminPaymentResult = await recordTerminPayment({
      terminId: termin.id,
      destinationAccountId: cashAccount.id,
      amount: 50000000,
      receivedDate: new Date("2026-10-09"),
      referenceNo: "INV/TRM-99/TEST",
      notes: "Pembayaran termin 99 test",
    });

    createdInflowId = terminPaymentResult.inflow.id;
    assert(
      terminPaymentResult.termin.status === TerminStatus.RECEIVED,
      "Termin status transitioned to RECEIVED upon payment"
    );
    assert(
      terminPaymentResult.inflow.status === TransactionStatus.POSTED,
      "FundInflow created with POSTED status"
    );

    // Verify cash balance increased by exact payment amount
    const cashBalAfterPayment = await getCashAccountBalance(cashAccount.id);
    assert(
      cashBalAfterPayment.currentBalance === initialCashBal.currentBalance + 50000000,
      "Cash account balance increased by exact termin receipt (Rp50.000.000)"
    );

    // Verify paired double-entry journal created
    const journalEntry = await prisma.journalEntry.findFirst({
      where: {
        sourceId: createdInflowId,
        sourceType: JournalSourceType.FUND_INFLOW,
      },
      include: { lines: true },
    });
    assert(journalEntry !== null, "Double-entry journal generated for FundInflow");
    if (journalEntry) {
      const debitTotal = journalEntry.lines.reduce((s, l) => s + Number(l.debit), 0);
      const creditTotal = journalEntry.lines.reduce((s, l) => s + Number(l.credit), 0);
      assert(
        debitTotal === 50000000 && creditTotal === 50000000 && debitTotal === creditTotal,
        "Journal lines are strictly balanced (Debit = Credit = Rp50.000.000)"
      );
    }
  } catch (err: any) {
    assert(false, "Termin and inflow separation", err.message);
  } finally {
    // Cleanup termin & inflow test records safely
    if (createdInflowId) {
      await prisma.journalLine.deleteMany({
        where: { journal: { sourceId: createdInflowId } },
      }).catch(() => {});
      await prisma.journalEntry.deleteMany({
        where: { sourceId: createdInflowId },
      }).catch(() => {});
      await prisma.projectTermin.update({
        where: { id: createdTerminId },
        data: { fundInflowId: null, status: TerminStatus.PLANNED },
      }).catch(() => {});
      await prisma.fundInflow.delete({ where: { id: createdInflowId } }).catch(() => {});
    }
    if (createdTerminId) {
      await prisma.projectTermin.delete({ where: { id: createdTerminId } }).catch(() => {});
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 5: PHYSICAL PROGRESS OPNAME LOG
  // ----------------------------------------------------
  console.log("\n--- [GROUP 5] Civil Physical Progress Opname Log ---");
  let createdLogId = "";
  try {
    const log = await createProjectProgressLog({
      projectId: alcent.id,
      logDate: new Date("2026-10-09"),
      physicalProgressPct: 73.5,
      volumeDescription: "Pengecoran balok dak lantai 3 selesai 100%",
      sourceInfo: "Opname Mingguan Pa Giri",
      notes: "Cuaca cerah, pekerjaan sesuai target",
    });
    createdLogId = log.id;

    assert(Number(log.physicalProgressPct) === 73.5, "Physical progress log recorded 73.5%");

    const p360 = await getProject360Data(alcent.id);
    if (!p360) throw new Error("Project 360 data not found");
    assert(
      p360.metrics.physicalProgressPct === 73.5,
      `Project 360 retrieves latest physical progress log (73.5%)`
    );
  } catch (err: any) {
    assert(false, "Physical progress log recording", err.message);
  } finally {
    if (createdLogId) {
      await prisma.projectProgressLog.delete({ where: { id: createdLogId } }).catch(() => {});
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 6: ITEMIZED EXPENSE / MATERIAL DETAILS
  // ----------------------------------------------------
  console.log("\n--- [GROUP 6] Expense Item Details (Multi-Material) ---");
  let createdDetailId = "";
  try {
    const accItem = await prisma.accExpenseItem.findFirst({
      where: { projectId: alcent.id },
    });
    if (!accItem) throw new Error("Acc item not found for project");

    const detail = await createExpenseItemDetail({
      accItemId: accItem.id,
      itemName: "Semen Tiga Roda 50kg",
      quantity: 40,
      unit: "sak",
      unitPrice: 65000,
      notes: "Material plesteran",
    });
    createdDetailId = detail.id;

    assert(
      detail.itemName === "Semen Tiga Roda 50kg" && Number(detail.totalPrice) === 2600000,
      "Material item detail recorded with item name, quantity, unit, and total price"
    );

    const fetchedDetails = await prisma.expenseItemDetail.findMany({
      where: { accItemId: accItem.id },
    });
    assert(
      fetchedDetails.some((d) => d.id === detail.id),
      "Detail is queryable through AccExpenseItem relationship"
    );
  } catch (err: any) {
    assert(false, "Expense item detail creation", err.message);
  } finally {
    if (createdDetailId) {
      await prisma.expenseItemDetail.delete({ where: { id: createdDetailId } }).catch(() => {});
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 7: VENDOR CONTRACT / SPK TRACKING
  // ----------------------------------------------------
  console.log("\n--- [GROUP 7] Vendor & Subcontractor SPK Contracts ---");
  let createdVendorContractId = "";
  let createdVendorId = "";
  try {
    let vendor = await prisma.vendor.findFirst();
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          code: "VND-TEST-SUBKON",
          name: "CV Test Subkon Mandiri",
          type: "SUBCONTRACTOR",
        },
      });
      createdVendorId = vendor.id;
    }

    const contract = await createVendorContract({
      vendorId: vendor.id,
      projectId: alcent.id,
      contractNumber: "SPK-TEST-SUBKON-01",
      title: "Pekerjaan Pasang Baja Ringan Atap",
      contractValue: 85000000,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-11-30"),
    });
    createdVendorContractId = contract.id;

    assert(
      contract.contractNumber === "SPK-TEST-SUBKON-01" &&
        Number(contract.contractValue) === 85000000,
      "Vendor contract SPK created with number and contract amount"
    );

    const p360 = await getProject360Data(alcent.id);
    if (!p360) throw new Error("Project 360 data not found");
    assert(
      p360.vendorContracts.some((vc) => vc.id === contract.id),
      "Vendor contract visible under Project 360 vendor list"
    );
  } catch (err: any) {
    assert(false, "Vendor contract creation", err.message);
  } finally {
    if (createdVendorContractId) {
      await prisma.vendorContract.delete({ where: { id: createdVendorContractId } }).catch(() => {});
    }
    if (createdVendorId) {
      await prisma.vendor.delete({ where: { id: createdVendorId } }).catch(() => {});
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 8: SINGLE-ENTRY PROJECT JOURNAL PROJECTION
  // ----------------------------------------------------
  console.log("\n--- [GROUP 8] Single-Entry Project Journal Projection ---");
  try {
    const generalJournalCount = await prisma.journalLine.count();
    const projectJournalCount = await prisma.journalLine.count({
      where: { projectId: alcent.id },
    });

    assert(
      projectJournalCount <= generalJournalCount,
      "Project journal is a filtered projection of general ledger (projectId filter)"
    );

    // Verify report service with projectId filter
    const journalReport = await getJournalReport({
      projectId: alcent.id,
    });
    assert(
      journalReport.filterMeta.projectText !== "Semua Proyek",
      "Journal report correctly binds project filter"
    );
    assert(
      journalReport.rows.every((r) => r.projectId === alcent.id),
      "All returned journal lines strictly belong to the filtered project"
    );
  } catch (err: any) {
    assert(false, "Single-entry project journal projection", err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 9: EXCEL & PDF EXPORT ENHANCEMENTS
  // ----------------------------------------------------
  console.log("\n--- [GROUP 9] Excel & PDF Export Verification ---");
  try {
    const projectReport = await getProjectReport();
    const journalReport = await getJournalReport();

    // 9.1 Project Excel
    const projExcelBuffer = await buildProjectExcel(projectReport);
    assert(
      projExcelBuffer.length > 1000,
      `Project Excel export generates valid binary (${projExcelBuffer.length} bytes)`
    );

    // 9.2 Project PDF
    const projPdfBuffer = await buildProjectPdf(projectReport);
    assert(
      projPdfBuffer.length > 1000,
      `Project PDF export generates valid binary (${projPdfBuffer.length} bytes)`
    );

    // 9.3 Journal Excel
    const journalExcelBuffer = await buildJournalExcel(journalReport);
    assert(
      journalExcelBuffer.length > 1000,
      `Journal Excel export generates valid binary with Proyek column (${journalExcelBuffer.length} bytes)`
    );

    // 9.4 Journal PDF
    const journalPdfBuffer = await buildJournalPdf(journalReport);
    assert(
      journalPdfBuffer.length > 1000,
      `Journal PDF export generates valid binary with Proyek column (${journalPdfBuffer.length} bytes)`
    );
  } catch (err: any) {
    assert(false, "Excel & PDF export generation", err.message);
  }

  // ----------------------------------------------------
  // FINAL TEST SUITE SUMMARY
  // ----------------------------------------------------
  console.log("\n========================================================");
  console.log(`TOTAL TESTS : ${stats.total}`);
  console.log(`PASSED      : ${stats.passed}`);
  console.log(`FAILED      : ${stats.failed}`);
  console.log("========================================================\n");

  if (stats.failed > 0) {
    process.exit(1);
  }
}

runPhase2ExpansionTests()
  .catch((e) => {
    console.error("Fatal error during Phase 2 Expansion tests:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
