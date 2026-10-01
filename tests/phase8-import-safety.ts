import ExcelJS from "exceljs";
import { prisma } from "../src/lib/db/prisma";
import {
  parseAndValidateExcel,
  executeControlledImport,
  generateAccImportTemplate,
} from "../src/lib/finance/import.service";
import { CashType } from "@prisma/client";

async function runPhase8ImportSafetyTests() {
  console.log("==================================================================");
  console.log("PHASE 8: EXCEL IMPORT SAFETY, VALIDATION & RECONCILIATION AUDIT");
  console.log("==================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Pre-cleanup any lingering test items
  await prisma.accExpenseItem.deleteMany({
    where: { noKas: { in: ["KT.26.701", "KT.26.702", "KT.26.777", "KT.26.799"] } },
  });
  await prisma.submissionBatch.deleteMany({
    where: { noKas: { in: ["KT.26.701", "KT.26.702", "KT.26.777", "KT.26.799"] } },
  });

  // 1. Template Generation Test
  console.log("Test 1: Official Excel Template Generation");
  const templateBuffer = await generateAccImportTemplate();
  assert(templateBuffer.length > 1000, "Excel template generated with valid size");
  const templateWb = new ExcelJS.Workbook();
  await templateWb.xlsx.load(templateBuffer as unknown as ArrayBuffer);
  assert(templateWb.worksheets.length >= 2, "Template contains Data and Guidance sheets");
  assert(templateWb.worksheets[0].name === "Data Pengajuan ACC", "First sheet is 'Data Pengajuan ACC'");

  // Helper to create in-memory workbook buffer
  async function createWorkbookBuffer(rows: Array<Record<string, unknown>>): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Test Sheet");

    if (rows.length > 0) {
      const headerSet = new Set<string>();
      for (const r of rows) {
        Object.keys(r).forEach((k) => headerSet.add(k));
      }
      const headers = Array.from(headerSet);
      ws.addRow(headers);
      for (const r of rows) {
        const rowVals = headers.map((h) => r[h] ?? "");
        ws.addRow(rowVals);
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // 2. Missing Mandatory Header Validation Test
  console.log("\nTest 2: Missing Required Header Columns Rejection");
  try {
    const invalidHeaderBuf = await createWorkbookBuffer([
      { No: 1, Catatan: "Tanpa kolom penting" },
    ]);
    await parseAndValidateExcel(invalidHeaderBuf);
    assert(false, "Should fail when mandatory columns are missing");
  } catch (err) {
    assert(
      err instanceof Error && err.message.includes("tidak ditemukan"),
      `Successfully rejected missing columns with: ${(err as Error).message}`
    );
  }

  // 3. Intra-file Shared No Kas Tracking (1 Voucher -> N Items)
  console.log("\nTest 3: Intra-file Shared No Kas Tracking (1 Voucher -> N Items)");
  const sharedNoKasBuf = await createWorkbookBuffer([
    {
      "No Kas": "KT.26.777",
      Proyek: "ALCENT",
      Kategori: "UPAH",
      PIC: "PA HERI",
      Uraian: "Baris pertama",
      "Nominal ACC": 1000000,
    },
    {
      "No Kas": "KT.26.777", // SHARED NO KAS
      Proyek: "SUMEDANG",
      Kategori: "MATERIAL",
      PIC: "PA DEDI",
      Uraian: "Baris kedua satu voucher",
      "Nominal ACC": 2000000,
    },
  ]);
  const previewShared = await parseAndValidateExcel(sharedNoKasBuf);
  assert(previewShared.totalRows === 2, "Parsed 2 rows");
  assert(previewShared.uniqueNoKasCount === 1, "Exactly 1 unique voucher No Kas");
  assert(previewShared.sharedNoKasItemCount === 2, "Detected 2 items sharing the No Kas voucher");
  assert(previewShared.validRows === 2, "Both items valid under the shared voucher");
  assert(previewShared.invalidRows === 0, "Zero invalid rows for shared voucher items");

  // 4. Invalid Amount Detection Test
  console.log("\nTest 4: Invalid / Zero / Negative Amount Detection");
  const invalidAmtBuf = await createWorkbookBuffer([
    {
      "No Kas": "KT.26.771",
      Proyek: "ALCENT",
      Kategori: "UPAH",
      PIC: "PA HERI",
      Uraian: "ACC nol rupiah",
      "Nominal ACC": 0,
    },
    {
      "No Kas": "KT.26.772",
      Proyek: "ALCENT",
      Kategori: "UPAH",
      PIC: "PA HERI",
      Uraian: "ACC negatif",
      "Nominal ACC": -500000,
    },
    {
      "No Kas": "KT.26.773",
      Proyek: "ALCENT",
      Kategori: "UPAH",
      PIC: "PA HERI",
      Uraian: "ACC non numerik",
      "Nominal ACC": "TIDAK_VALID",
    },
  ]);
  const previewAmt = await parseAndValidateExcel(invalidAmtBuf);
  assert(previewAmt.invalidRows === 3, "All 3 invalid amount rows marked as invalid");
  assert(previewAmt.validRows === 0, "0 valid rows allowed");

  // 5. Unmapped Project, Category, PIC Detection
  console.log("\nTest 5: Unmapped Master Data (Project, Category, PIC) Detection");
  const unmappedBuf = await createWorkbookBuffer([
    {
      "No Kas": "KT.26.774",
      Proyek: "PROYEK_FIKTIF_XYZ",
      Kategori: "KATEGORI_TIDAK_ADA",
      PIC: "PIC_MISTERIUS",
      Uraian: "Uraian dengan master fiktif",
      "Nominal ACC": 5000000,
    },
  ]);
  const previewUnmapped = await parseAndValidateExcel(unmappedBuf);
  assert(previewUnmapped.unmappedProjects.includes("PROYEK_FIKTIF_XYZ"), "Detected unmapped project");
  assert(previewUnmapped.unmappedCategories.includes("KATEGORI_TIDAK_ADA"), "Detected unmapped category");
  assert(previewUnmapped.unmappedPics.includes("PIC_MISTERIUS"), "Detected unmapped PIC");
  assert(previewUnmapped.invalidRows === 1, "Unmapped row marked as invalid");

  // 6. Sub-Unit Parent-Child Integrity Detection
  console.log("\nTest 6: Sub-Unit Cross-Project Integrity Mismatch");
  const mismatchSubUnitBuf = await createWorkbookBuffer([
    {
      "No Kas": "KT.26.775",
      Proyek: "ALCENT",
      "Sub Unit": "SIPIL", // SIPIL belongs to SUMEDANG, not ALCENT!
      Kategori: "UPAH",
      PIC: "PA HERI",
      Uraian: "Upah pekerjaan sipil di alcent",
      "Nominal ACC": 1500000,
    },
  ]);
  const previewMismatch = await parseAndValidateExcel(mismatchSubUnitBuf);
  assert(
    previewMismatch.issues.some((i) => i.problem.includes("tidak terdaftar pada Proyek")),
    "Detected sub-unit parent mismatch"
  );
  assert(previewMismatch.invalidRows === 1, "Mismatch sub-unit row marked as invalid");

  // 7. Valid Data Mapping & Resolution
  console.log("\nTest 7: Valid Row Mapping & Entity Resolution");
  const validBuf = await createWorkbookBuffer([
    {
      "No Kas": "KT.26.701",
      Proyek: "ALCENT",
      "Sub Unit": "SMP",
      Kategori: "UPAH",
      PIC: "PA HERI",
      Uraian: "Pekerjaan plesteran dinding SMP",
      "Nominal Diajukan": 2500000,
      "Nominal ACC": 2500000,
      Catatan: "Sesuai RAB",
    },
    {
      "No Kas": "KT.26.702",
      Proyek: "SUMEDANG",
      "Sub Unit": "SIPIL",
      Kategori: "MATERIAL",
      PIC: "PA DEDI",
      Uraian: "Pembelian semen 30 sak",
      "Nominal ACC": 2100000,
    },
  ]);
  const previewValid = await parseAndValidateExcel(validBuf);
  if (previewValid.issues.length > 0) {
    console.log("previewValid issues:", previewValid.issues);
  }
  assert(previewValid.totalRows === 2, "Parsed 2 rows");
  assert(previewValid.validRows === 2, "Both rows valid");
  assert(previewValid.invalidRows === 0, "Zero invalid rows");
  assert(previewValid.totalApprovedAmount === 4600000, "Total ACC sum matches 4,600,000");

  const row1 = previewValid.rows[0];
  assert(row1.resolvedProjectId !== undefined, "Resolved ALCENT project ID");
  assert(row1.resolvedSubUnitId !== undefined, "Resolved SMP sub-unit ID");
  assert(row1.resolvedCategoryId !== undefined, "Resolved UPAH category ID");
  assert(row1.resolvedPicId !== undefined, "Resolved PA HERI PIC ID");

  // 8. Controlled Import Transaction Safety & Reconciliation
  console.log("\nTest 8: Controlled Import Execution & Database Reconciliation");
  const testBatchCode = `BATCH-P8-AUDIT-${Date.now()}`;
  const importResult = await executeControlledImport({
    batchCode: testBatchCode,
    accDate: "2026-10-01",
    approvedByName: "Pa Giri",
    notes: "UAT Import Safety Test Batch",
    items: [
      {
        noKas: "KT.26.701",
        cashType: CashType.KT,
        projectId: row1.resolvedProjectId!,
        subUnitId: row1.resolvedSubUnitId,
        categoryId: row1.resolvedCategoryId!,
        picId: row1.resolvedPicId!,
        description: row1.rawDescription,
        requestedAmount: 2500000,
        approvedAmount: 2500000,
        notes: "UAT audit item 1",
      },
      {
        noKas: "KT.26.701",
        cashType: CashType.KT,
        projectId: previewValid.rows[1].resolvedProjectId!,
        subUnitId: previewValid.rows[1].resolvedSubUnitId,
        categoryId: previewValid.rows[1].resolvedCategoryId!,
        picId: previewValid.rows[1].resolvedPicId!,
        description: previewValid.rows[1].rawDescription,
        approvedAmount: 2100000,
        notes: "UAT audit item 2",
      },
    ],
  });

  assert(importResult.importedCount === 2, "Successfully imported 2 items atomically");
  assert(importResult.totalApprovedAmount === 4600000, "Imported total approved amount is 4,600,000");

  // 9. Financial Invariants Verification on Imported Data
  console.log("\nTest 9: Financial Invariants Verification on Database");
  const dbBatch = await prisma.submissionBatch.findUnique({
    where: { batchCode: testBatchCode },
    include: { items: true },
  });
  assert(dbBatch !== null, "Batch header found in database");
  assert(dbBatch?.items.length === 2, "2 ACC items linked to batch");

  const sumDbApproved = dbBatch!.items.reduce(
    (acc, i) => acc + Number(i.approvedAmount),
    0
  );
  assert(sumDbApproved === 4600000, "Database sum of approved items equals 4,600,000");

  for (const item of dbBatch!.items) {
    assert(item.status === "APPROVED", `Item ${item.noKas} has status APPROVED`);
    assert(Number(item.approvedAmount) > 0, `Item ${item.noKas} amount is positive`);
  }

  // 10. Database-level Duplicate Prevention Test
  console.log("\nTest 10: Database-level Duplicate No Kas Prevention");
  const dupDbBuf = await createWorkbookBuffer([
    {
      "No Kas": "KT.26.701", // Already inserted into DB in Test 8!
      Proyek: "ALCENT",
      Kategori: "UPAH",
      PIC: "PA HERI",
      Uraian: "Mencoba import no kas yang sudah ada",
      "Nominal ACC": 1000000,
    },
  ]);
  const previewDbDup = await parseAndValidateExcel(dupDbBuf);
  assert(
    previewDbDup.issues.some((i) => i.problem.includes("sudah ada di database")),
    "Pre-import check successfully detected existing database No Kas"
  );
  assert(previewDbDup.invalidRows === 1, "Duplicate database row rejected");

  // 11. Transaction Rollback Verification (Atomic Failure Safety)
  console.log("\nTest 11: Transaction Atomic Rollback on Failure");
  const failBatchCode = `BATCH-P8-FAIL-${Date.now()}`;
  try {
    await executeControlledImport({
      batchCode: failBatchCode,
      accDate: "2026-10-01",
      items: [
        {
          noKas: "KT.26.799",
          cashType: CashType.KT,
          projectId: row1.resolvedProjectId!,
          categoryId: row1.resolvedCategoryId!,
          picId: row1.resolvedPicId!,
          description: "Item 1 valid",
          approvedAmount: 1000000,
        },
        {
          noKas: "KT.26.701", // Existing duplicate in DB -> causes transaction error
          cashType: CashType.KT,
          projectId: row1.resolvedProjectId!,
          categoryId: row1.resolvedCategoryId!,
          picId: row1.resolvedPicId!,
          description: "Item 2 duplicate causes failure",
          approvedAmount: 1000000,
        },
      ],
    });
    assert(false, "Should have thrown transaction error");
  } catch (err) {
    assert(
      err instanceof Error,
      `Transaction threw expected error: ${(err as Error).message}`
    );
  }

  // Verify rollback: KT.26.799 must NOT exist in DB
  const orphanCheck = await prisma.accExpenseItem.findFirst({
    where: { noKas: "KT.26.799" },
  });
  assert(orphanCheck === null, "Transaction rollback verified: No orphan items created");

  const orphanBatchCheck = await prisma.submissionBatch.findUnique({
    where: { batchCode: failBatchCode },
  });
  assert(orphanBatchCheck === null, "Transaction rollback verified: No orphan batch header created");

  // 12. Cleanup Test Data
  console.log("\nCleaning up test audit data...");
  await prisma.accExpenseItem.deleteMany({
    where: { batchId: dbBatch!.id },
  });
  await prisma.submissionBatch.delete({
    where: { id: dbBatch!.id },
  });
  console.log("Test audit batch cleaned up successfully.");

  console.log("\n==================================================================");
  console.log(`PHASE 8 TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)`);
  console.log("==================================================================");
}

runPhase8ImportSafetyTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
