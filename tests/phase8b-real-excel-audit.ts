import ExcelJS from "exceljs";
import { prisma } from "../src/lib/db/prisma";
import { parseAndValidateExcel, executeControlledImport } from "../src/lib/finance/import.service";
import { createDisbursement } from "../src/lib/finance/disbursement.service";
import { CashType, PaymentMethod } from "@prisma/client";
import { analyzeRealWorkbook } from "./real-workbook-analyzer";
import path from "path";

async function runPhase8BRealExcelAuditTests() {
  console.log("==================================================================");
  console.log("PHASE 8B: REAL EXCEL MAPPING, MULTI-ITEM NO KAS & AUDIT TEST SUITE");
  console.log("==================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

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

  // Fetch active master records for test assertions
  const [alcentProj, sumedangProj, upahCat, materialCat, paHeriPic, paDediPic, cashAccount] =
    await Promise.all([
      prisma.project.findFirstOrThrow({ where: { code: "ALCENT" }, include: { subUnits: true } }),
      prisma.project.findFirstOrThrow({ where: { code: "SUMEDANG" }, include: { subUnits: true } }),
      prisma.expenseCategory.findFirstOrThrow({ where: { code: "UPAH" } }),
      prisma.expenseCategory.findFirstOrThrow({ where: { code: "MATERIAL" } }),
      prisma.fieldPic.findFirstOrThrow({ where: { name: "PA HERI" } }),
      prisma.fieldPic.findFirstOrThrow({ where: { name: "PA DEDI" } }),
      prisma.cashAccount.findFirstOrThrow({ where: { accountCode: "KAS_NISA" } }),
    ]);

  // TEST 1: Multiple expense items sharing ONE No Kas -> 1 ACC Batch, N ACC Items
  console.log("--- TEST 1: Multiple Expense Items Sharing One No Kas (1 Batch -> N Items) ---");
  const randSuffix = Math.floor(800 + Math.random() * 190);
  const test1NoKas = `KU.26.${randSuffix}`;
  const batch1Code = `BATCH-P8B-T1-${Date.now()}`;

  const import1 = await executeControlledImport({
    batchCode: batch1Code,
    accDate: "2026-10-01",
    approvedByName: "Pa Giri",
    notes: "Test 1: Multiple items under one No Kas voucher",
    items: [
      {
        noKas: test1NoKas,
        cashType: CashType.KU,
        projectId: alcentProj.id,
        categoryId: upahCat.id,
        picId: paHeriPic.id,
        description: "BPJS Kesehatan Karyawan",
        approvedAmount: 1194312,
      },
      {
        noKas: test1NoKas,
        cashType: CashType.KU,
        projectId: alcentProj.id,
        categoryId: upahCat.id,
        picId: paHeriPic.id,
        description: "BPJS Ketenagakerjaan",
        approvedAmount: 450000,
      },
      {
        noKas: test1NoKas,
        cashType: CashType.KU,
        projectId: alcentProj.id,
        categoryId: upahCat.id,
        picId: paHeriPic.id,
        description: "Listrik Kantor",
        approvedAmount: 503500,
      },
    ],
  });

  assert(import1.importedCount === 3, "Imported 3 items under single voucher");
  assert(import1.totalApprovedAmount === 1194312 + 450000 + 503500, "Total approved matches sum of all items");

  const dbBatch1 = await prisma.submissionBatch.findUnique({
    where: { batchCode: batch1Code },
    include: { items: { orderBy: { itemNo: "asc" } } },
  });
  assert(dbBatch1 !== null, "Found parent SubmissionBatch in database");
  assert(dbBatch1?.noKas === test1NoKas, "Batch header carries No Kas identifier");
  assert(dbBatch1?.items.length === 3, "Exactly 3 items linked to batch");
  assert(dbBatch1?.items[0].itemNo === 1, "Item 1 has itemNo = 1");
  assert(dbBatch1?.items[1].itemNo === 2, "Item 2 has itemNo = 2");
  assert(dbBatch1?.items[2].itemNo === 3, "Item 3 has itemNo = 3");
  assert(
    Boolean(dbBatch1?.items && dbBatch1.items.length > 0 && dbBatch1.items.every((i) => i.noKas === test1NoKas)),
    "All 3 items share identical No Kas"
  );

  // TEST 2: One ACC item with no realization -> ACC exists, Realization = 0
  console.log("\n--- TEST 2: One ACC Item With No Realization ---");
  const testItem2 = dbBatch1!.items[0];
  const item2Detail = await prisma.accExpenseItem.findUnique({
    where: { id: testItem2.id },
    include: { disbursementItems: true },
  });
  const item2Realized = item2Detail!.disbursementItems.reduce(
    (sum, d) => sum + Number(d.realizedAmount),
    0
  );
  assert(item2Detail?.status === "APPROVED", "Status is initial APPROVED");
  assert(item2Realized === 0, "Realization amount is exactly 0");
  assert(
    Number(item2Detail!.approvedAmount) - item2Realized === Number(item2Detail!.approvedAmount),
    "Outstanding equals full approved amount"
  );

  // TEST 3: Partial realization -> Approved > Realized, Outstanding > 0
  console.log("\n--- TEST 3: Partial Realization Workflow ---");
  const testItem3 = dbBatch1!.items[1]; // approved 450,000
  // Disburse 200,000
  const voucher3 = await createDisbursement({
    disbursementDate: new Date("2026-10-01"),
    cashAccountId: cashAccount.id,
    paymentMethod: PaymentMethod.CASH,
    totalRealizedAmount: 200000,
    notes: "Pencairan sebagian Test 3",
    items: [
      {
        accItemId: testItem3.id,
        realizedAmount: 200000,
      },
    ],
  });

  assert(voucher3.disbursement !== null, "Disbursement voucher created");
  const refreshedItem3 = await prisma.accExpenseItem.findUnique({
    where: { id: testItem3.id },
    include: { disbursementItems: true },
  });
  const refreshedRealized = refreshedItem3!.disbursementItems.reduce(
    (sum, d) => sum + Number(d.realizedAmount),
    0
  );
  assert(refreshedItem3?.status === "PARTIALLY_REALIZED", "Status transitioned to PARTIALLY_REALIZED");
  assert(refreshedRealized === 200000, "Realized amount is 200,000");
  assert(
    Number(refreshedItem3!.approvedAmount) - refreshedRealized === 250000,
    "Outstanding is strictly Approved (450,000) - Realized (200,000) = 250,000"
  );

  // TEST 4: Multiple Date Blocks in One Sheet
  console.log("\n--- TEST 4: Multiple Date Blocks in One Sheet ---");
  const realWorkbookPath = path.join(
    process.cwd(),
    "Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx"
  );
  const auditReport = await analyzeRealWorkbook(realWorkbookPath);

  const sheet2Juli = auditReport.recapSheets.find((s) => s.sheetName.includes("2 JULI"));
  assert(sheet2Juli !== undefined, "Found '2 JULI' recap sheet");
  assert(
    sheet2Juli!.dateBlocks.length >= 2,
    `'2 JULI' sheet contains ${sheet2Juli?.dateBlocks.length} distinct date blocks (e.g. 2 JULI, 4 JULI)`
  );

  // TEST 5: Recap + Detail Sheet Separation (No Double Counting)
  console.log("\n--- TEST 5: Recap vs Detail Sheet Architecture (No Double Counting) ---");
  assert(auditReport.recapSheets.length === 44, "Detected exactly 44 Type A Recap Sheets");
  assert(auditReport.detailSheets.length === 36, "Detected exactly 36 Type B Detail/Mandor Sheets");
  assert(
    auditReport.detailSheets.every((d) => d.pics.length > 0),
    "All Type B sheets correctly identified as Mandor/PIC breakdowns"
  );

  // TEST 6: Repeated Weekly Snapshots De-duplication
  console.log("\n--- TEST 6: Repeated Weekly Snapshots De-duplication ---");
  assert(
    auditReport.snapshotsDetected.length > 50,
    `Identified ${auditReport.snapshotsDetected.length} recurring No Kas vouchers tracked across consecutive weeks`
  );

  // TEST 7: Malformed No Kas Row-Level Error Handling
  console.log("\n--- TEST 7: Malformed No Kas Row-Level Error Handling ---");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Test Sheet");
  ws.addRow(["No Kas", "Proyek", "Kategori", "PIC", "Uraian", "Nominal ACC"]);
  ws.addRow(["NO_KAS_NGASAL", "ALCENT", "UPAH", "PA HERI", "Baris dengan no kas ngasal", 1000000]);
  ws.addRow(["KT.26.882", "ALCENT", "UPAH", "PA HERI", "Baris dengan no kas valid", 2000000]);
  const malformedBuf = Buffer.from(await wb.xlsx.writeBuffer());

  const previewMalformed = await parseAndValidateExcel(malformedBuf);
  assert(previewMalformed.totalRows === 2, "Parsed 2 rows");
  assert(previewMalformed.validRows === 1, "Exactly 1 valid row retained");
  assert(previewMalformed.invalidRows === 1, "Malformed row isolated as invalid");
  assert(
    previewMalformed.issues.some((i) => i.row === 2 && i.field === "No Kas"),
    "Row 2 flagged with specific No Kas format problem"
  );

  // CLEANUP TEST DATA
  console.log("\nCleaning up Phase 8B test audit records...");
  await prisma.disbursementItem.deleteMany({
    where: { accItemId: { in: dbBatch1!.items.map((i) => i.id) } },
  });
  await prisma.journalEntry.deleteMany({
    where: { sourceType: "DISBURSEMENT", sourceId: voucher3.disbursement.id },
  });
  await prisma.disbursement.deleteMany({
    where: { id: voucher3.disbursement.id },
  });
  await prisma.accExpenseItem.deleteMany({
    where: { batchId: dbBatch1!.id },
  });
  await prisma.submissionBatch.delete({
    where: { id: dbBatch1!.id },
  });
  console.log("Phase 8B test data cleaned up successfully.");

  console.log("\n==================================================================");
  console.log(`PHASE 8B TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)`);
  console.log("==================================================================");
}

runPhase8BRealExcelAuditTests()
  .catch((err) => {
    console.error("Phase 8B test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
