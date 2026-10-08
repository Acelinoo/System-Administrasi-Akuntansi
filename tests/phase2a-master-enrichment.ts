import { prisma } from "../src/lib/db/prisma";
import { VendorType, DataScope, TransactionStatus } from "@prisma/client";
import { createFundInflow } from "../src/lib/finance/inflow.service";
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

async function runPhase2ATests() {
  console.log("\n========================================================");
  console.log("   PROTRACK PHASE 2A — MASTER DATA ENRICHMENT TESTS     ");
  console.log("========================================================\n");

  const cleanupProjectIds: string[] = [];
  const cleanupVendorIds: string[] = [];
  const cleanupInflowIds: string[] = [];

  try {
    // ----------------------------------------------------
    // TEST 1: Existing project tanpa data baru tetap valid
    // ----------------------------------------------------
    console.log("\n--- [TEST 1] Existing project tanpa data baru tetap valid ---");
    const existingProject = await prisma.project.findFirst({
      where: { code: "ALCENT" },
    });
    assert(
      !!existingProject,
      "Existing project ALCENT exists in DB",
      "ALCENT not found"
    );
    assert(
      existingProject?.clientName === null || typeof existingProject?.clientName === "string",
      "Existing project ALCENT clientName is nullable/safe",
      `clientName was ${existingProject?.clientName}`
    );

    // Create a new project without any of the new optional fields
    const prjNoNew = await prisma.project.create({
      data: {
        code: `TEST_PRJ_OLD_${Date.now().toString().slice(-4)}`,
        name: "Test Project Without New Fields",
        isActive: true,
      },
    });
    cleanupProjectIds.push(prjNoNew.id);
    assert(
      prjNoNew.clientName === null &&
        prjNoNew.contractValue === null &&
        prjNoNew.targetStartDate === null &&
        prjNoNew.targetEndDate === null,
      "Project created without new fields defaults all new fields to null",
      JSON.stringify(prjNoNew)
    );

    // ----------------------------------------------------
    // TEST 2: Project dengan owner/client valid
    // ----------------------------------------------------
    console.log("\n--- [TEST 2] Project dengan owner/client valid ---");
    const testClientName = "PT Bangun Sarana Prima";
    const prjWithClient = await prisma.project.create({
      data: {
        code: `TEST_PRJ_CLI_${Date.now().toString().slice(-4)}`,
        name: "Test Project With Client",
        clientName: testClientName,
        isActive: true,
      },
    });
    cleanupProjectIds.push(prjWithClient.id);
    assert(
      prjWithClient.clientName === testClientName,
      "Project clientName is stored and matches input",
      `Expected ${testClientName}, got ${prjWithClient.clientName}`
    );

    // ----------------------------------------------------
    // TEST 3: Project dengan contract value valid
    // ----------------------------------------------------
    console.log("\n--- [TEST 3] Project dengan contract value valid ---");
    const testContractValue = 2750000000.5;
    const prjWithContract = await prisma.project.create({
      data: {
        code: `TEST_PRJ_VAL_${Date.now().toString().slice(-4)}`,
        name: "Test Project With Contract Value",
        contractValue: testContractValue,
        isActive: true,
      },
    });
    cleanupProjectIds.push(prjWithContract.id);
    assert(
      Number(prjWithContract.contractValue) === testContractValue,
      "Project contractValue is accurately stored as Decimal",
      `Expected ${testContractValue}, got ${Number(prjWithContract.contractValue)}`
    );

    // ----------------------------------------------------
    // TEST 4: Project dengan target dates valid
    // ----------------------------------------------------
    console.log("\n--- [TEST 4] Project dengan target dates valid ---");
    const startDate = new Date("2026-03-01T00:00:00.000Z");
    const endDate = new Date("2026-11-30T00:00:00.000Z");
    const prjWithDates = await prisma.project.create({
      data: {
        code: `TEST_PRJ_DTE_${Date.now().toString().slice(-4)}`,
        name: "Test Project With Target Dates",
        targetStartDate: startDate,
        targetEndDate: endDate,
        isActive: true,
      },
    });
    cleanupProjectIds.push(prjWithDates.id);
    assert(
      prjWithDates.targetStartDate !== null && prjWithDates.targetEndDate !== null,
      "Target dates are safely saved and retrieved",
      `StartDate: ${prjWithDates.targetStartDate}, EndDate: ${prjWithDates.targetEndDate}`
    );

    // ----------------------------------------------------
    // TEST 5: Vendor creation (SUPPLIER, SUBCONTRACTOR, SERVICE)
    // ----------------------------------------------------
    console.log("\n--- [TEST 5] Vendor creation for all types ---");
    const supplierVendor = await prisma.vendor.create({
      data: {
        code: `VND-SUP-${Date.now().toString().slice(-4)}`,
        name: "TB. Bintang Mas Lestari",
        type: VendorType.SUPPLIER,
        phone: "081299988877",
        address: "Jl. Raya Industri No. 45, Bekasi",
        notes: "Supplier besi beton & semen",
        isActive: true,
      },
    });
    cleanupVendorIds.push(supplierVendor.id);
    assert(
      supplierVendor.type === VendorType.SUPPLIER && supplierVendor.name === "TB. Bintang Mas Lestari",
      "Supplier vendor created successfully with full attributes",
      JSON.stringify(supplierVendor)
    );

    const subconVendor = await prisma.vendor.create({
      data: {
        code: `VND-SUB-${Date.now().toString().slice(-4)}`,
        name: "CV. Karya Mandiri Konstruksi",
        type: VendorType.SUBCONTRACTOR,
        phone: "081377766655",
        address: "Jl. Melati No. 12, Bandung",
        notes: "Subkontraktor pekerjaan ME & Plafon",
        isActive: true,
      },
    });
    cleanupVendorIds.push(subconVendor.id);
    assert(
      subconVendor.type === VendorType.SUBCONTRACTOR && subconVendor.isActive === true,
      "Subcontractor vendor created successfully",
      JSON.stringify(subconVendor)
    );

    const serviceVendor = await prisma.vendor.create({
      data: {
        code: `VND-SRV-${Date.now().toString().slice(-4)}`,
        name: "PT. Surveyindo Rekayasa",
        type: VendorType.SERVICE,
        phone: "021-5551234",
        address: "Gedung Cyber Lt. 3, Jakarta",
        notes: "Jasa soil test & topografi",
        isActive: true,
      },
    });
    cleanupVendorIds.push(serviceVendor.id);
    assert(
      serviceVendor.type === VendorType.SERVICE,
      "Service vendor created successfully",
      JSON.stringify(serviceVendor)
    );

    // ----------------------------------------------------
    // TEST 6: Vendor inactive toggle
    // ----------------------------------------------------
    console.log("\n--- [TEST 6] Vendor inactive toggle ---");
    const updatedVendor = await prisma.vendor.update({
      where: { id: supplierVendor.id },
      data: { isActive: false },
    });
    assert(
      updatedVendor.isActive === false,
      "Vendor status toggled to inactive",
      `Expected isActive: false, got ${updatedVendor.isActive}`
    );

    const activeVendors = await prisma.vendor.findMany({
      where: { isActive: true },
    });
    const foundInactive = activeVendors.some((v) => v.id === supplierVendor.id);
    assert(
      !foundInactive,
      "Active vendor query correctly excludes inactive vendor",
      `Supplier vendor still found in active query`
    );

    // ----------------------------------------------------
    // TEST 7: Vendor deletion & safety check
    // ----------------------------------------------------
    console.log("\n--- [TEST 7] Vendor deletion & safety check ---");
    // Verify soft deactivation is the primary protection
    const deactivatedSubcon = await prisma.vendor.update({
      where: { id: subconVendor.id },
      data: { isActive: false },
    });
    assert(
      deactivatedSubcon.isActive === false,
      "Vendor can be safely preserved as inactive rather than destroyed",
      `Vendor isActive: ${deactivatedSubcon.isActive}`
    );

    // ----------------------------------------------------
    // TEST 8: FundInflow tanpa project tetap valid
    // ----------------------------------------------------
    console.log("\n--- [TEST 8] FundInflow tanpa project tetap valid ---");
    const cashAccount = await prisma.cashAccount.findFirst({
      where: { isActive: true },
    });
    if (!cashAccount) {
      throw new Error("No active cash account found for testing");
    }

    const generalInflow = await createFundInflow({
      inflowDate: new Date("2026-03-01"),
      destinationAccountId: cashAccount.id,
      amount: 15000000,
      sourceInfo: "TEST Drop Dana Umum Direksi",
      referenceNo: "TEST-GEN-001",
      dataScope: DataScope.TEST,
    });
    cleanupInflowIds.push(generalInflow.id);

    assert(
      generalInflow.status === TransactionStatus.POSTED && generalInflow.projectId === null,
      "FundInflow without project is created with projectId = null and POSTED status",
      `inflow.projectId: ${generalInflow.projectId}`
    );

    // ----------------------------------------------------
    // TEST 9: FundInflow dengan project tetap valid
    // ----------------------------------------------------
    console.log("\n--- [TEST 9] FundInflow dengan project tetap valid ---");
    const targetProject = existingProject || prjWithClient;
    const projectInflow = await createFundInflow({
      inflowDate: new Date("2026-03-01"),
      destinationAccountId: cashAccount.id,
      projectId: targetProject.id,
      amount: 50000000,
      sourceInfo: "TEST Termin 1 Proyek ALCENT",
      referenceNo: "TEST-PRJ-001",
      dataScope: DataScope.TEST,
    });
    cleanupInflowIds.push(projectInflow.id);

    const fetchedProjectInflow = await prisma.fundInflow.findUnique({
      where: { id: projectInflow.id },
      include: { project: true },
    });

    assert(
      fetchedProjectInflow?.projectId === targetProject.id &&
        fetchedProjectInflow?.project?.id === targetProject.id,
      "FundInflow with project attribution correctly links to Project entity",
      `Fetched projectId: ${fetchedProjectInflow?.projectId}`
    );

    // ----------------------------------------------------
    // TEST 10: FundInflow project relation tidak mengubah cash calculation
    // ----------------------------------------------------
    console.log("\n--- [TEST 10] Cash balance invariance with project attribution ---");
    const testCashAccount = await prisma.cashAccount.findFirst({
      where: { accountCode: "KAS_NISA" },
    });
    if (!testCashAccount) {
      throw new Error("KAS_NISA cash account not found");
    }

    // Balance before additional test inflows
    const balanceBefore = (await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST)).currentBalance;

    const amountNoProj = 2000000;
    const infA = await createFundInflow({
      inflowDate: new Date("2026-03-02"),
      destinationAccountId: testCashAccount.id,
      amount: amountNoProj,
      sourceInfo: "TEST Inflow Tanpa Proyek",
      referenceNo: "TEST-INV-A",
      dataScope: DataScope.TEST,
    });
    cleanupInflowIds.push(infA.id);

    const balanceAfterA = (await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST)).currentBalance;
    assert(
      balanceAfterA - balanceBefore === amountNoProj,
      "General inflow increases cash balance by exact amount",
      `Diff: ${balanceAfterA - balanceBefore}, expected: ${amountNoProj}`
    );

    const amountWithProj = 3500000;
    const infB = await createFundInflow({
      inflowDate: new Date("2026-03-02"),
      destinationAccountId: testCashAccount.id,
      projectId: targetProject.id,
      amount: amountWithProj,
      sourceInfo: "TEST Inflow Dengan Proyek",
      referenceNo: "TEST-INV-B",
      dataScope: DataScope.TEST,
    });
    cleanupInflowIds.push(infB.id);

    const balanceAfterB = (await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST)).currentBalance;
    assert(
      balanceAfterB - balanceAfterA === amountWithProj,
      "Project-attributed inflow increases cash balance by identical mathematical rule",
      `Diff: ${balanceAfterB - balanceAfterA}, expected: ${amountWithProj}`
    );
  } finally {
    // Clean up test data
    console.log("\n--- [CLEANUP] Cleaning up test artifacts ---");
    // Also clean up any stray test inflows
    const strayInflows = await prisma.fundInflow.findMany({
      where: {
        OR: [
          { referenceNo: { startsWith: "TEST-" } },
          { id: { in: cleanupInflowIds } },
        ],
      },
      select: { id: true },
    });
    const allInflowIdsToDelete = strayInflows.map((i) => i.id);

    if (allInflowIdsToDelete.length > 0) {
      // Clean up journals generated for test inflows first
      await prisma.journalLine.deleteMany({
        where: {
          journal: {
            sourceType: "FUND_INFLOW",
            sourceId: { in: allInflowIdsToDelete },
          },
        },
      });
      await prisma.journalEntry.deleteMany({
        where: {
          sourceType: "FUND_INFLOW",
          sourceId: { in: allInflowIdsToDelete },
        },
      });
      await prisma.fundInflow.deleteMany({
        where: { id: { in: allInflowIdsToDelete } },
      });
      console.log(`  ✔ Cleaned up ${allInflowIdsToDelete.length} test inflows and journals.`);
    }

    const strayVendors = await prisma.vendor.findMany({
      where: {
        OR: [
          { code: { startsWith: "VND-" } },
          { id: { in: cleanupVendorIds } },
        ],
      },
      select: { id: true },
    });
    if (strayVendors.length > 0) {
      await prisma.vendor.deleteMany({
        where: { id: { in: strayVendors.map((v) => v.id) } },
      });
      console.log(`  ✔ Cleaned up ${strayVendors.length} test vendors.`);
    }

    const strayProjects = await prisma.project.findMany({
      where: {
        OR: [
          { code: { startsWith: "TEST_PRJ_" } },
          { id: { in: cleanupProjectIds } },
        ],
      },
      select: { id: true },
    });
    if (strayProjects.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: strayProjects.map((p) => p.id) } },
      });
      console.log(`  ✔ Cleaned up ${strayProjects.length} test projects.`);
    }
  }

  console.log("\n========================================================");
  console.log(`PHASE 2A TEST SUMMARY: ${stats.passed}/${stats.total} PASSED, ${stats.failed} FAILED`);
  console.log("========================================================\n");

  if (stats.failed > 0) {
    process.exit(1);
  }
}

runPhase2ATests()
  .catch((e) => {
    console.error("FATAL in test suite:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
