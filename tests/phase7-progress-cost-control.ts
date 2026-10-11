import { prisma } from "../src/lib/db/prisma";
import {
  DataScope,
  TransactionStatus,
  CashType,
  AccStatus,
  PaymentMethod,
  PicAssignmentStatus,
  AccountType,
} from "@prisma/client";
import {
  createSubmissionBatch,
} from "../src/lib/finance/acc.service";
import {
  createFundInflow,
} from "../src/lib/finance/inflow.service";
import {
  createDisbursement,
  voidDisbursement,
} from "../src/lib/finance/disbursement.service";
import {
  getProject360Data,
  createProjectBudget,
  addBudgetItem,
  createProjectProgressLog,
  createExpenseItemDetail,
} from "../src/lib/finance/project-360.service";
import { getProjectReport } from "../src/lib/reports/project-report.service";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function recordResult(name: string, fn: () => Promise<{ passed: boolean; message: string }>) {
  try {
    const res = await fn();
    results.push({ name, passed: res.passed, message: res.message });
    console.log(`[${res.passed ? "PASS" : "FAIL"}] ${name} - ${res.message}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, message: `Exception: ${errorMsg}` });
    console.log(`[FAIL] ${name} - Exception: ${errorMsg}`);
  }
}

async function main() {
  console.log("======================================================================");
  console.log("   PROTRACK PHASE 7 — MONITORING PROGRES & PENGENDALIAN BIAYA         ");
  console.log("======================================================================\n");

  // -------------------------------------------------------------------------
  // INVARIANT 0: PRE-CHECK REAL BASELINE
  // -------------------------------------------------------------------------
  await recordResult("0. Baseline REAL Invariant Pre-Check", async () => {
    const batches = await prisma.submissionBatch.count({ where: { dataScope: DataScope.REAL } });
    const items = await prisma.accExpenseItem.count({ where: { dataScope: DataScope.REAL } });
    const sumAgg = await prisma.accExpenseItem.aggregate({
      where: { dataScope: DataScope.REAL },
      _sum: { approvedAmount: true },
    });
    const realDisb = await prisma.disbursement.count({ where: { dataScope: DataScope.REAL } });
    const realJournals = await prisma.journalEntry.count({ where: { dataScope: DataScope.REAL } });

    const approvedTotal = Number(sumAgg._sum.approvedAmount ?? 0);
    const passed =
      batches === 379 &&
      items === 1028 &&
      approvedTotal === 4303052418 &&
      realDisb === 0 &&
      realJournals === 0;

    return {
      passed,
      message: `REAL Batches: ${batches} (379), Items: ${items} (1028), Total: Rp${approvedTotal.toLocaleString("id-ID")} (Rp4.303.052.418), REAL Disb: ${realDisb}, REAL Journals: ${realJournals}`,
    };
  });

  // Setup isolated test entities
  const testTimestamp = Date.now();
  const testProjectCode = `PRJ-P7-${testTimestamp}`.slice(0, 30);

  const testProject = await prisma.project.create({
    data: {
      code: testProjectCode,
      name: "Proyek Uji Coba Monitoring Progres & Biaya P7",
      contractValue: 50000000,
      targetStartDate: new Date("2026-01-01"),
      targetEndDate: new Date("2026-12-31"),
      projectType: "KONTRAKTOR",
      isActive: true,
    },
  });

  const testAccount = await prisma.cashAccount.create({
    data: {
      accountCode: `TEST-CASH-${testTimestamp}`.slice(0, 30),
      accountName: "Kas Uji Coba P7",
      accountType: AccountType.BANK,
      openingBalance: 0,
      isActive: true,
    },
  });

  const category = await prisma.expenseCategory.findFirst({ where: { isActive: true } });
  const pic = await prisma.fieldPic.findFirst({ where: { isActive: true } });

  if (!category || !pic) {
    throw new Error("Master data Category atau PIC tidak tersedia.");
  }

  // Provide initial liquidity to test cash account (Rp 100.000.000)
  const inflow = await createFundInflow({
    inflowDate: new Date(),
    destinationAccountId: testAccount.id,
    amount: 100000000,
    sourceInfo: "Dropping Dana Uji Coba P7",
    referenceNo: `IN-P7-${testTimestamp}`,
    projectId: testProject.id,
    dataScope: DataScope.TEST,
  });

  // Track created test IDs for safe cleanup
  let createdBudget1Id = "";
  let createdBatch1Id = "";
  let createdDisb1Id = "";
  let createdDisb2Id = "";
  let createdDisb3Id = "";

  // -------------------------------------------------------------------------
  // TEST 1: RAP BUDGET CREATION & INITIAL STATUS
  // -------------------------------------------------------------------------
  await recordResult("1. Penyusunan RAP & Status Anggaran Awal (Pagu Rp20.000.000)", async () => {
    const budgetRes = await createProjectBudget({
      projectId: testProject.id,
      title: "RAP Awal Proyek P7",
      notes: "Pagu RAP uji coba",
      dataScope: DataScope.TEST,
    });
    createdBudget1Id = budgetRes.id;

    // Add budget items: Rp 12.000.000 (Material) + Rp 8.000.000 (Upah) = Rp 20.000.000
    await addBudgetItem({
      budgetId: createdBudget1Id,
      description: "Pekerjaan Struktur & Material",
      category: category.code,
      volume: 1,
      unit: "ls",
      unitPrice: 12000000,
    });
    await addBudgetItem({
      budgetId: createdBudget1Id,
      description: "Upah Tenaga Kerja",
      category: "UPAH",
      volume: 1,
      unit: "ls",
      unitPrice: 8000000,
    });

    const p360 = await getProject360Data(testProject.id, DataScope.TEST);
    const passed =
      p360 !== null &&
      p360.metrics.totalRapBudget === 20000000 &&
      p360.metrics.totalPostedExpense === 0 &&
      p360.metrics.remainingRapBudget === 20000000 &&
      p360.metrics.costVarianceStatus === "HEALTHY" &&
      p360.metrics.hasBudget === true;

    return {
      passed,
      message: `Total RAP: Rp${p360?.metrics.totalRapBudget}, Realisasi: Rp${p360?.metrics.totalPostedExpense}, Sisa: Rp${p360?.metrics.remainingRapBudget}, Status: ${p360?.metrics.costVarianceStatus}`,
    };
  });

  // -------------------------------------------------------------------------
  // TEST 2: REALISASI SEHAT (50% BURN RATE) -> STATUS HEALTHY
  // -------------------------------------------------------------------------
  await recordResult("2. Realisasi 50% Anggaran (Rp10.000.000 / Rp20.000.000) -> HEALTHY", async () => {
    // Create ACC batch with items
    const batchRes = await createSubmissionBatch({
      batchCode: `BATCH-P7-A-${testTimestamp}`.slice(0, 50),
      accDate: new Date(),
      approvedByName: "Pa Giri",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: category.id,
          picId: pic.id,
          description: "Pengadaan Material Tahap 1",
          approvedAmount: 15000000,
        },
      ],
    });
    createdBatch1Id = batchRes.batch.id;
    const accItem1 = batchRes.items[0];

    // Disburse Rp 10.000.000 (50% of RAP Rp 20.000.000)
    const disb1 = await createDisbursement({
      disbursementDate: new Date(),
      cashAccountId: testAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 10000000,
      dataScope: DataScope.TEST,
      items: [
        {
          accItemId: accItem1.id,
          realizedAmount: 10000000,
        },
      ],
    });
    createdDisb1Id = disb1.disbursement.id;

    const p360 = await getProject360Data(testProject.id, DataScope.TEST);
    const passed =
      p360 !== null &&
      p360.metrics.totalPostedExpense === 10000000 &&
      p360.metrics.remainingRapBudget === 10000000 &&
      p360.metrics.budgetBurnRatePct === 50 &&
      p360.metrics.costVarianceStatus === "HEALTHY";

    return {
      passed,
      message: `Realisasi: Rp${p360?.metrics.totalPostedExpense}, Burn Rate: ${p360?.metrics.budgetBurnRatePct}%, Sisa RAP: Rp${p360?.metrics.remainingRapBudget}, Status: ${p360?.metrics.costVarianceStatus}`,
    };
  });

  // -------------------------------------------------------------------------
  // TEST 3: REALISASI MENDEKATI ANGGARAN (92.5% BURN RATE) -> STATUS WARNING
  // -------------------------------------------------------------------------
  await recordResult("3. Realisasi 92.5% Anggaran (Rp18.500.000 / Rp20.000.000) -> WARNING", async () => {
    // Add additional disbursement Rp 8.500.000 on another acc item
    const batch2 = await createSubmissionBatch({
      batchCode: `BATCH-P7-B-${testTimestamp}`.slice(0, 50),
      accDate: new Date(),
      approvedByName: "Pa Giri",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: category.id,
          picId: pic.id,
          description: "Pengadaan Material Tambahan",
          approvedAmount: 10000000,
        },
      ],
    });
    const accItem2 = batch2.items[0];

    const disb2 = await createDisbursement({
      disbursementDate: new Date(),
      cashAccountId: testAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 8500000,
      dataScope: DataScope.TEST,
      items: [
        {
          accItemId: accItem2.id,
          realizedAmount: 8500000,
        },
      ],
    });
    createdDisb2Id = disb2.disbursement.id;

    const p360 = await getProject360Data(testProject.id, DataScope.TEST);
    const passed =
      p360 !== null &&
      p360.metrics.totalPostedExpense === 18500000 &&
      p360.metrics.remainingRapBudget === 1500000 &&
      p360.metrics.budgetBurnRatePct === 92.5 &&
      p360.metrics.costVarianceStatus === "WARNING";

    return {
      passed,
      message: `Realisasi: Rp${p360?.metrics.totalPostedExpense}, Burn Rate: ${p360?.metrics.budgetBurnRatePct}%, Sisa RAP: Rp${p360?.metrics.remainingRapBudget}, Status: ${p360?.metrics.costVarianceStatus}`,
    };
  });

  // -------------------------------------------------------------------------
  // TEST 4: REALISASI MELAMPAUI ANGGARAN (107.5% BURN RATE) -> STATUS OVERBUDGET
  // -------------------------------------------------------------------------
  await recordResult("4. Realisasi Melampaui RAP (Rp21.500.000 / Rp20.000.000) -> OVERBUDGET", async () => {
    // Disburse additional Rp 3.000.000 -> Total Rp 21.500.000 (> Rp 20.000.000)
    const batch3 = await createSubmissionBatch({
      batchCode: `BATCH-P7-C-${testTimestamp}`.slice(0, 50),
      accDate: new Date(),
      approvedByName: "Pa Giri",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: category.id,
          picId: pic.id,
          description: "Pengeluaran Ekstra Lapangan",
          approvedAmount: 5000000,
        },
      ],
    });
    const accItem3 = batch3.items[0];

    const disb3 = await createDisbursement({
      disbursementDate: new Date(),
      cashAccountId: testAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 3000000,
      dataScope: DataScope.TEST,
      items: [
        {
          accItemId: accItem3.id,
          realizedAmount: 3000000,
        },
      ],
    });
    createdDisb3Id = disb3.disbursement.id;

    const p360 = await getProject360Data(testProject.id, DataScope.TEST);
    const passed =
      p360 !== null &&
      p360.metrics.totalPostedExpense === 21500000 &&
      p360.metrics.remainingRapBudget === -1500000 &&
      p360.metrics.budgetBurnRatePct === 107.5 &&
      p360.metrics.costVarianceStatus === "OVERBUDGET";

    return {
      passed,
      message: `Realisasi: Rp${p360?.metrics.totalPostedExpense}, Burn Rate: ${p360?.metrics.budgetBurnRatePct}%, Sisa RAP: -Rp${Math.abs(p360?.metrics.remainingRapBudget || 0)}, Status: ${p360?.metrics.costVarianceStatus}`,
    };
  });

  // -------------------------------------------------------------------------
  // TEST 5: PENCEGAHAN DOUBLE COUNTING (EXPENSE DETAIL & JURNAL TIDAK MENGGANDAKAN BIAYA)
  // -------------------------------------------------------------------------
  await recordResult("5. Pencegahan Double Counting (Rincian Material & Jurnal)", async () => {
    // Ambil item pengeluaran yang sudah cair
    const anyAccItem = await prisma.accExpenseItem.findFirst({
      where: { projectId: testProject.id, dataScope: DataScope.TEST },
    });
    if (!anyAccItem) throw new Error("AccExpenseItem tidak ditemukan");

    // Catat rincian material (ExpenseItemDetail) nominal Rp 5.000.000 (100 * 50.000)
    await createExpenseItemDetail({
      accItemId: anyAccItem.id,
      itemName: "Semen Tiga Roda 100 Sak",
      quantity: 100,
      unit: "sak",
      unitPrice: 50000,
    });

    // Panggil ulang getProject360Data
    const p360 = await getProject360Data(testProject.id, DataScope.TEST);

    // BIAYA REALISASI HARUS TETAP Rp 21.500.000 (tidak bertambah menjadi 26.500.000!)
    const passed = p360 !== null && p360.metrics.totalPostedExpense === 21500000;

    return {
      passed,
      message: `Total Biaya Realisasi Terjaga: Rp${p360?.metrics.totalPostedExpense} (Tidak terduplikasi oleh rincian material Rp5.000.000)`,
    };
  });

  // -------------------------------------------------------------------------
  // TEST 6: PENGECUALIAN TRANSAKSI VOID DARI REALISASI BIAYA
  // -------------------------------------------------------------------------
  await recordResult("6. Pengecualian Transaksi VOID dari Realisasi Biaya Proyek", async () => {
    // Void voucher disb3 (Rp 3.000.000)
    await voidDisbursement(createdDisb3Id, "Pembatalan Uji Coba P7");

    const p360 = await getProject360Data(testProject.id, DataScope.TEST);

    // Biaya realisasi harus turun kembali dari 21.500.000 menjadi 18.500.000
    // dan status berubah dari OVERBUDGET kembali ke WARNING
    const passed =
      p360 !== null &&
      p360.metrics.totalPostedExpense === 18500000 &&
      p360.metrics.remainingRapBudget === 1500000 &&
      p360.metrics.costVarianceStatus === "WARNING";

    return {
      passed,
      message: `Setelah VOID Rp3jt: Realisasi turun ke Rp${p360?.metrics.totalPostedExpense}, Sisa RAP naik ke Rp${p360?.metrics.remainingRapBudget}, Status: ${p360?.metrics.costVarianceStatus}`,
    };
  });

  // -------------------------------------------------------------------------
  // TEST 7: MONITORING PROGRES FISIK & HISTORI OPNAME LAPANGAN
  // -------------------------------------------------------------------------
  await recordResult("7. Monitoring Progres Fisik Sipil & Histori Opname", async () => {
    // Log 1: Opname 15% pada tanggal 2026-02-01
    await createProjectProgressLog({
      projectId: testProject.id,
      logDate: new Date("2026-02-01"),
      physicalProgressPct: 15.0,
      volumeDescription: "Pekerjaan pondasi dan galian",
      sourceInfo: "Pengawas Sipil Lapangan",
    });

    // Log 2: Opname 35% pada tanggal 2026-03-01 (terbaru)
    await createProjectProgressLog({
      projectId: testProject.id,
      logDate: new Date("2026-03-01"),
      physicalProgressPct: 35.0,
      volumeDescription: "Pekerjaan struktur kolom lantai 1",
      sourceInfo: "Site Engineer",
    });

    const p360 = await getProject360Data(testProject.id, DataScope.TEST);
    const passed =
      p360 !== null &&
      p360.metrics.physicalProgressPct === 35.0 &&
      p360.metrics.hasProgressLog === true &&
      p360.progressLogs.length === 2 &&
      Number(p360.progressLogs[0].physicalProgressPct) === 35.0 && // Terurut desc
      Number(p360.progressLogs[1].physicalProgressPct) === 15.0;

    return {
      passed,
      message: `Progres Terkini: ${p360?.metrics.physicalProgressPct}%, Jumlah Log: ${p360?.progressLogs.length}, Log Terkini: "${p360?.progressLogs[0].volumeDescription}"`,
    };
  });

  // -------------------------------------------------------------------------
  // TEST 8: INTEGRASI LAPORAN MONITORING PROYEK (getProjectReport)
  // -------------------------------------------------------------------------
  await recordResult("8. Integrasi Laporan Monitoring Proyek (getProjectReport)", async () => {
    const report = await getProjectReport({
      projectId: testProject.id,
      dataScope: "TEST",
    });

    const projSummary = report.projects.find((p) => p.projectId === testProject.id);
    const passed =
      projSummary !== undefined &&
      projSummary.totalBudget === 20000000 &&
      projSummary.realizedAmount === 18500000 &&
      projSummary.costVarianceStatus === "WARNING" &&
      projSummary.physicalProgressPct === 35.0 &&
      projSummary.categories.length > 0;

    return {
      passed,
      message: `Report Proyek: ${projSummary?.projectCode}, Budget: Rp${projSummary?.totalBudget}, Realisasi: Rp${projSummary?.realizedAmount}, Status: ${projSummary?.costVarianceStatus}, Fisik: ${projSummary?.physicalProgressPct}%`,
    };
  });

  // -------------------------------------------------------------------------
  // CLEANUP ISOLATED TEST DATA
  // -------------------------------------------------------------------------
  console.log("\nMembersihkan entitas sementara pengujian Phase 7...");

  // Delete progress logs
  await prisma.projectProgressLog.deleteMany({ where: { projectId: testProject.id } });

  // Delete budget items and budget
  await prisma.budgetItem.deleteMany({ where: { budget: { projectId: testProject.id } } });
  await prisma.projectBudget.deleteMany({ where: { projectId: testProject.id } });

  // Delete expense item details
  await prisma.expenseItemDetail.deleteMany({
    where: { accItem: { dataScope: DataScope.TEST } },
  });

  // Delete journal lines and journals
  await prisma.journalLine.deleteMany({
    where: { journal: { dataScope: DataScope.TEST } },
  });
  await prisma.journalEntry.deleteMany({
    where: { dataScope: DataScope.TEST },
  });

  // Delete disbursement items and disbursements
  await prisma.disbursementItem.deleteMany({
    where: { disbursement: { dataScope: DataScope.TEST } },
  });
  await prisma.disbursement.deleteMany({
    where: { dataScope: DataScope.TEST },
  });

  // Delete acc items and batches
  await prisma.accExpenseItem.deleteMany({
    where: { dataScope: DataScope.TEST },
  });
  await prisma.submissionBatch.deleteMany({
    where: { dataScope: DataScope.TEST },
  });

  // Delete inflows
  await prisma.fundInflow.deleteMany({
    where: { dataScope: DataScope.TEST },
  });

  // Delete cash account
  await prisma.cashAccount.deleteMany({ where: { accountCode: testAccount.accountCode } });

  // Delete project
  await prisma.project.deleteMany({ where: { id: testProject.id } });

  // -------------------------------------------------------------------------
  // FINAL INVARIANT CHECK: REAL BASELINE PRESERVED 100%
  // -------------------------------------------------------------------------
  await recordResult("9. Final Verification — REAL Baseline 100% Preserved", async () => {
    const batches = await prisma.submissionBatch.count({ where: { dataScope: DataScope.REAL } });
    const items = await prisma.accExpenseItem.count({ where: { dataScope: DataScope.REAL } });
    const sumAgg = await prisma.accExpenseItem.aggregate({
      where: { dataScope: DataScope.REAL },
      _sum: { approvedAmount: true },
    });
    const realDisb = await prisma.disbursement.count({ where: { dataScope: DataScope.REAL } });
    const realJournals = await prisma.journalEntry.count({ where: { dataScope: DataScope.REAL } });

    const approvedTotal = Number(sumAgg._sum.approvedAmount ?? 0);
    const passed =
      batches === 379 &&
      items === 1028 &&
      approvedTotal === 4303052418 &&
      realDisb === 0 &&
      realJournals === 0;

    return {
      passed,
      message: `REAL Batches: ${batches} (379), Items: ${items} (1028), Total: Rp${approvedTotal.toLocaleString("id-ID")} (Rp4.303.052.418), Disb: ${realDisb} (0), Journals: ${realJournals} (0)`,
    };
  });

  console.log("\n======================================================================");
  console.log("   RINGKASAN HASIL PENGUJIAN OTOMATIS PHASE 7                         ");
  console.log("======================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`Total Pengujian: ${results.length}`);
  console.log(`Lolos (PASS)   : ${totalPassed}`);
  console.log(`Gagal (FAIL)   : ${results.length - totalPassed}`);
  console.log(`Status         : ${totalPassed === results.length ? "SEMUA PENGUJIAN LOLOS (100%)" : "ADA PENGUJIAN GAGAL"}`);
  console.log("======================================================================\n");

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal Error running Phase 7 test suite:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
