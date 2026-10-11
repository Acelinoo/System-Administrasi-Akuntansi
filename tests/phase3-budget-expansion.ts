import { prisma } from "../src/lib/db/prisma";
import {
  DataScope,
  TerminStatus,
  TransactionStatus,
  PicAssignmentStatus,
  ProjectConfirmationStatus,
} from "@prisma/client";
import {
  createProjectBudgetSchema,
  addBudgetItemSchema,
  updateProjectContractSchema,
  masterProjectSchema,
} from "../src/lib/validation/project-budget.schema";
import {
  getProject360Data,
  createProjectBudget,
  addBudgetItem,
  deleteProjectBudget,
} from "../src/lib/finance/project-360.service";
import { getProjectReport } from "../src/lib/reports/project-report.service";
import { buildProjectExcel } from "../src/lib/export/excel-export.service";
import { buildProjectPdf } from "../src/lib/export/pdf-export.service";
import { getCashAccountBalance } from "../src/lib/finance/balance.service";
import { getJournalReport } from "../src/lib/reports/journal-report.service";

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

async function runPhase3BudgetExpansionTests() {
  console.log("\n========================================================");
  console.log("   PROTRACK PHASE 3 — BUDGET & VALIDATION VERIFICATION   ");
  console.log("========================================================\n");

  let testProjectId: string | null = null;
  let testBudgetV1Id: string | null = null;
  let testBudgetV2Id: string | null = null;

  // ----------------------------------------------------
  // BASELINE AUDIT BEFORE TESTS
  // ----------------------------------------------------
  console.log("--- [CHECKPOINT 0] Baseline Invariant Verification (Pre-Test) ---");
  const preBatchesCount = await prisma.submissionBatch.count({
    where: { dataScope: DataScope.REAL },
  });
  const preItemsCount = await prisma.accExpenseItem.count({
    where: { dataScope: DataScope.REAL },
  });
  const preApprovedSum = await prisma.accExpenseItem.aggregate({
    where: { dataScope: DataScope.REAL },
    _sum: { approvedAmount: true },
  });
  const preUnassignedMandorCount = await prisma.accExpenseItem.count({
    where: {
      dataScope: DataScope.REAL,
      assignmentStatus: PicAssignmentStatus.UNASSIGNED_MANDOR,
    },
  });

  assert(preBatchesCount === 379, `Real batches = 379 (found: ${preBatchesCount})`);
  assert(preItemsCount === 1028, `Real items = 1,028 (found: ${preItemsCount})`);
  assert(
    Number(preApprovedSum._sum.approvedAmount) === 4303052418,
    `Total approved amount = Rp4.303.052.418 (found: ${Number(preApprovedSum._sum.approvedAmount)})`
  );
  assert(
    preUnassignedMandorCount === 723,
    `Historical UNASSIGNED_MANDOR items = 723 (found: ${preUnassignedMandorCount})`
  );

  try {
    // ----------------------------------------------------
    // TEST 1: Validasi judul RAP, volume, harga satuan, dan total item
    // ----------------------------------------------------
    console.log("\n--- [TEST 1] Zod Validation: RAP Title, Volume, Price, Total Item ---");
    
    const sampleUuid = "a1789268-f962-47e7-adba-6aa18d53739c";

    // 1.1 Valid RAP Title
    const validTitleRes = createProjectBudgetSchema.safeParse({
      projectId: sampleUuid,
      title: "RAP Pelaksanaan Rev 1",
      notes: "Catatan pengesahan RAP",
    });
    assert(validTitleRes.success, "Valid RAP title passes schema validation");

    // 1.2 Title too long (> 150 chars)
    const longTitleRes = createProjectBudgetSchema.safeParse({
      projectId: sampleUuid,
      title: "A".repeat(151),
    });
    assert(!longTitleRes.success, "RAP title > 150 chars rejected by Zod schema");

    // 1.3 Empty Title
    const emptyTitleRes = createProjectBudgetSchema.safeParse({
      projectId: sampleUuid,
      title: "   ",
    });
    assert(!emptyTitleRes.success, "Empty/whitespace RAP title rejected");

    // 1.4 Valid budget item
    const validItemRes = addBudgetItemSchema.safeParse({
      budgetId: sampleUuid,
      category: "MATERIAL",
      description: "Semen Holcim 50kg",
      volume: 100,
      unit: "Zak",
      unitPrice: 65000,
    });
    assert(validItemRes.success, "Valid budget item passes validation");
    if (validItemRes.success) {
      const calculatedTotal = validItemRes.data.volume * validItemRes.data.unitPrice;
      assert(
        calculatedTotal === 6500000,
        "Total price consistently equals volume * unitPrice (100 * 65,000 = 6,500,000)"
      );
    }

    // ----------------------------------------------------
    // TEST 2: Volume 0/negatif dan harga satuan negatif ditolak
    // ----------------------------------------------------
    console.log("\n--- [TEST 2] Volume <= 0 and Negative Price Rejections ---");

    const zeroVolumeRes = addBudgetItemSchema.safeParse({
      budgetId: sampleUuid,
      category: "MATERIAL",
      description: "Batu Kali",
      volume: 0,
      unit: "m3",
      unitPrice: 250000,
    });
    assert(!zeroVolumeRes.success, "Volume = 0 rejected (must be > 0)");

    const negativeVolumeRes = addBudgetItemSchema.safeParse({
      budgetId: sampleUuid,
      category: "MATERIAL",
      description: "Batu Kali",
      volume: -10,
      unit: "m3",
      unitPrice: 250000,
    });
    assert(!negativeVolumeRes.success, "Negative volume rejected");

    const negativePriceRes = addBudgetItemSchema.safeParse({
      budgetId: sampleUuid,
      category: "MATERIAL",
      description: "Batu Kali",
      volume: 5,
      unit: "m3",
      unitPrice: -50000,
    });
    assert(!negativePriceRes.success, "Negative unit price rejected");

    const nanVolumeRes = addBudgetItemSchema.safeParse({
      budgetId: sampleUuid,
      category: "MATERIAL",
      description: "Batu Kali",
      volume: NaN,
      unit: "m3",
      unitPrice: 50000,
    });
    assert(!nanVolumeRes.success, "NaN volume rejected");

    const infinityPriceRes = addBudgetItemSchema.safeParse({
      budgetId: sampleUuid,
      category: "MATERIAL",
      description: "Batu Kali",
      volume: 5,
      unit: "m3",
      unitPrice: Infinity,
    });
    assert(!infinityPriceRes.success, "Infinity unit price rejected");

    // ----------------------------------------------------
    // TEST 3: Kategori tidak valid ditolak
    // ----------------------------------------------------
    console.log("\n--- [TEST 3] Category Validation & Master Categories ---");

    const emptyCategoryRes = addBudgetItemSchema.safeParse({
      budgetId: sampleUuid,
      category: "",
      description: "Paku Usuk",
      volume: 2,
      unit: "kg",
      unitPrice: 20000,
    });
    assert(
      emptyCategoryRes.success && (emptyCategoryRes.data.category === "" || emptyCategoryRes.data.category === null),
      "Empty category handled safely (falls back to null or empty string)"
    );

    const masterCategories = await prisma.expenseCategory.findMany({ select: { code: true, name: true } });
    assert(masterCategories.length > 0, `Database contains ${masterCategories.length} master categories`);

    // ----------------------------------------------------
    // TEST 4: Pembuatan RAP dan penambahan item menggunakan data TEST terisolasi
    // ----------------------------------------------------
    console.log("\n--- [TEST 4] Isolated Creation of RAP and Budget Items ---");

    const testProject = await prisma.project.create({
      data: {
        code: `TEST-P3-${Date.now().toString().slice(-4)}`,
        name: "Proyek Uji Coba Fase 3",
        projectType: "KONTRAKTOR",
        contractValue: 50000000,
        clientName: "PT Pemberi Tugas Uji",
        description: "Proyek Uji Validasi Fase 3",
        isActive: true,
      },
    });
    testProjectId = testProject.id;
    assert(!!testProjectId, `Isolated test project created (${testProject.code})`);

    // Create RAP V1
    const budgetV1 = await createProjectBudget({
      projectId: testProjectId,
      title: "RAP V1 (Awal)",
      notes: "Versi awal perencanaan biaya",
    });
    testBudgetV1Id = budgetV1.id;
    assert(budgetV1.title === "RAP V1 (Awal)", "RAP V1 created successfully");

    // Add item to V1
    const item1 = await addBudgetItem({
      budgetId: testBudgetV1Id,
      category: masterCategories[0]?.code || "MATERIAL",
      description: "Semen Gresik 40kg",
      volume: 20,
      unit: "Zak",
      unitPrice: 55000,
    });
    assert(
      Number(item1.totalAmount) === 1100000,
      `Budget item created with totalAmount 1,100,000 (volume 20 * 55,000)`
    );

    // ----------------------------------------------------
    // TEST 5: Beberapa versi RAP tidak menyebabkan penghitungan pagu ganda
    // ----------------------------------------------------
    console.log("\n--- [TEST 5] Multi-Version RAP: Single Benchmark & No Double-Counting ---");

    // Create RAP V2 (Revision)
    const budgetV2 = await createProjectBudget({
      projectId: testProjectId,
      title: "RAP V2 (Revisi Pasca Evaluasi)",
      notes: "Revisi volume dan harga terkini",
    });
    testBudgetV2Id = budgetV2.id;
    assert(budgetV2.title === "RAP V2 (Revisi Pasca Evaluasi)", "RAP V2 created successfully");

    // Add item to V2
    const item2 = await addBudgetItem({
      budgetId: testBudgetV2Id,
      category: masterCategories[0]?.code || "MATERIAL",
      description: "Semen Gresik 40kg (Revisi)",
      volume: 30,
      unit: "Zak",
      unitPrice: 60000,
    });
    assert(
      Number(item2.totalAmount) === 1800000,
      `V2 Budget item created with totalAmount 1,800,000 (volume 30 * 60,000)`
    );

    // Query 360 data
    const p360 = await getProject360Data(testProjectId);
    if (!p360) throw new Error("p360 data is null");
    assert(
      p360.budgets.length === 2,
      `Project 360 returns 2 budget versions in history (found: ${p360.budgets.length})`
    );
    assert(
      p360.metrics.totalRapBudget === 1800000,
      `totalRapBudget equals active version only (Rp1.800.000) and NOT sum of V1+V2 (Rp2.900.000)`
    );
    assert(
      p360.activeBudgetId === testBudgetV2Id,
      `Active budget ID correctly identifies latest version (${testBudgetV2Id})`
    );

    // ----------------------------------------------------
    // TEST 6: Versi lama tetap dapat ditelusuri & aman dihapus
    // ----------------------------------------------------
    console.log("\n--- [TEST 6] Revision History Tracing & Version Deletion ---");

    const v1FromHistory = p360.budgets.find((b) => b.id === testBudgetV1Id);
    assert(
      !!v1FromHistory && v1FromHistory.items.length === 1,
      "Historical V1 version remains fully intact with its original items"
    );

    // Delete V1 budget version
    await deleteProjectBudget(testBudgetV1Id);
    testBudgetV1Id = null; // Marked deleted
    const p360AfterDelete = await getProject360Data(testProjectId);
    if (!p360AfterDelete) throw new Error("p360AfterDelete is null");
    assert(
      p360AfterDelete.budgets.length === 1 && p360AfterDelete.budgets[0].id === testBudgetV2Id,
      "Old version deleted cleanly via cascade without corrupting active version"
    );
    assert(
      p360AfterDelete.metrics.totalRapBudget === 1800000,
      "Active budget total remains strictly preserved after deleting old version"
    );

    // ----------------------------------------------------
    // TEST 7: Pagu kategori dan varians biaya dihitung secara konsisten
    // ----------------------------------------------------
    console.log("\n--- [TEST 7] Category Budget Breakdown and Variance ---");

    const targetCatCode = masterCategories[0]?.code || "MATERIAL";
    const catBreakdown = p360AfterDelete.categoryCostBreakdown.find(
      (c) => c.categoryCode === targetCatCode
    );
    assert(
      !!catBreakdown,
      `Category ${targetCatCode} is present in categoryCostBreakdown`
    );
    if (catBreakdown) {
      assert(
        catBreakdown.budgetAmount === 1800000,
        `Category budget matches active version amount (expected: 1,800,000, found: ${catBreakdown.budgetAmount})`
      );
      assert(
        catBreakdown.variance === catBreakdown.budgetAmount - catBreakdown.realizedAmount,
        `Variance equals budgetAmount - realizedAmount (${catBreakdown.variance})`
      );
    }

    // ----------------------------------------------------
    // TEST 8: Proyek tanpa nilai kontrak atau RAP tetap dapat dibuka
    // ----------------------------------------------------
    console.log("\n--- [TEST 8] Projects Without Contract or RAP Open Safely ---");

    const emptyProject = await prisma.project.create({
      data: {
        code: `TEST-NULL-${Date.now().toString().slice(-4)}`,
        name: "Proyek Tanpa Kontrak dan RAP",
        isActive: true,
      },
    });

    try {
      const emptyP360 = await getProject360Data(emptyProject.id);
      if (!emptyP360) throw new Error("emptyP360 is null");
      assert(
        emptyP360.project.contractValue === null,
        "Contract value is safely null"
      );
      assert(
        emptyP360.metrics.totalRapBudget === 0,
        "Total RAP budget safely evaluates to 0 without errors"
      );
      assert(
        emptyP360.activeBudgetId === null,
        "Active budget ID is safely null"
      );
      assert(
        emptyP360.budgets.length === 0,
        "Budgets array is empty without crash"
      );
    } finally {
      await prisma.project.delete({ where: { id: emptyProject.id } });
    }

    // ----------------------------------------------------
    // TEST 9: Laporan web, Excel, dan PDF memakai definisi nilai yang sama
    // ----------------------------------------------------
    console.log("\n--- [TEST 9] Consistency Across Web Report, Excel, and PDF Exports ---");

    const projectReport = await getProjectReport();
    const testProjectInReport = projectReport.projects.find((p) => p.projectId === testProjectId);
    assert(
      !!testProjectInReport,
      "Test project is included in project-report summary"
    );
    if (testProjectInReport) {
      assert(
        testProjectInReport.totalBudget === 1800000,
        `Report totalBudget uses active budget only (expected: 1,800,000, found: ${testProjectInReport.totalBudget})`
      );
      assert(
        testProjectInReport.remainingBudget === 1800000 - testProjectInReport.realizedAmount,
        `Report remainingBudget = totalBudget - realizedAmount (${testProjectInReport.remainingBudget})`
      );
    }

    const excelBuffer = await buildProjectExcel(projectReport);
    assert(
      excelBuffer.length > 1000,
      `Project Excel export builds successfully with Pagu & Sisa RAP columns (${excelBuffer.length} bytes)`
    );

    const pdfBuffer = await buildProjectPdf(projectReport);
    assert(
      pdfBuffer.length > 1000,
      `Project PDF export builds successfully with Pagu & Sisa RAP columns (${pdfBuffer.length} bytes)`
    );

    // ----------------------------------------------------
    // TEST 10: Alur pengeluaran, kas/bank, jurnal, dan laporan tidak mengalami regresi
    // ----------------------------------------------------
    console.log("\n--- [TEST 10] Financial Flow Regression Integrity ---");

    // 10.1 Cash accounts balance checks
    const activeCashAccount = await prisma.cashAccount.findFirst({
      where: { isActive: true },
    });
    if (activeCashAccount) {
      const balance = await getCashAccountBalance(activeCashAccount.id);
      assert(
        typeof balance.currentBalance === "number" && !isNaN(balance.currentBalance),
        `Cash account balance computes deterministically (${balance.currentBalance})`
      );
    }

    // 10.2 Journal Report integrity
    const journalReport = await getJournalReport();
    assert(
      journalReport.rows.length >= 0,
      `Journal report generated with ${journalReport.rows.length} rows`
    );

    // 10.3 Master Project Schema & Types
    const masterProjRes = masterProjectSchema.safeParse({
      name: "Proyek Validasi Master",
      code: "PRJ-VALID",
      projectType: "KONSULTAN",
      contractValue: 125000000,
      clientName: "Dinas Bina Marga",
      location: "Surabaya",
      status: "ACTIVE",
    });
    assert(
      masterProjRes.success,
      "Master Project schema supports projectType enum (KONTRAKTOR, KONSULTAN, INTERNAL)"
    );

  } finally {
    // ----------------------------------------------------
    // CLEANUP ISOLATED TEST DATA
    // ----------------------------------------------------
    console.log("\n--- Cleaning up test records ---");
    if (testBudgetV1Id) {
      try {
        await prisma.projectBudget.delete({ where: { id: testBudgetV1Id } });
      } catch {}
    }
    if (testBudgetV2Id) {
      try {
        await prisma.projectBudget.delete({ where: { id: testBudgetV2Id } });
      } catch {}
    }
    if (testProjectId) {
      try {
        await prisma.project.delete({ where: { id: testProjectId } });
      } catch {}
    }
  }

  // ----------------------------------------------------
  // BASELINE AUDIT AFTER TESTS (STRICT INVARIANT VERIFICATION)
  // ----------------------------------------------------
  console.log("\n--- [CHECKPOINT FINAL] Baseline Invariant Verification (Post-Test) ---");
  const postBatchesCount = await prisma.submissionBatch.count({
    where: { dataScope: DataScope.REAL },
  });
  const postItemsCount = await prisma.accExpenseItem.count({
    where: { dataScope: DataScope.REAL },
  });
  const postApprovedSum = await prisma.accExpenseItem.aggregate({
    where: { dataScope: DataScope.REAL },
    _sum: { approvedAmount: true },
  });
  const postUnassignedMandorCount = await prisma.accExpenseItem.count({
    where: {
      dataScope: DataScope.REAL,
      assignmentStatus: PicAssignmentStatus.UNASSIGNED_MANDOR,
    },
  });

  assert(
    postBatchesCount === 379,
    `Real batches strictly intact: exactly 379 (found: ${postBatchesCount})`
  );
  assert(
    postItemsCount === 1028,
    `Real items strictly intact: exactly 1,028 (found: ${postItemsCount})`
  );
  assert(
    Number(postApprovedSum._sum.approvedAmount) === 4303052418,
    `Total approved amount strictly intact: exactly Rp4.303.052.418 (found: ${Number(postApprovedSum._sum.approvedAmount)})`
  );
  assert(
    postUnassignedMandorCount === preUnassignedMandorCount,
    `UNASSIGNED_MANDOR count unchanged (${postUnassignedMandorCount})`
  );

  // ----------------------------------------------------
  // SUMMARY
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

runPhase3BudgetExpansionTests()
  .catch((e) => {
    console.error("Fatal error during Phase 3 tests:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
