import { prisma } from "../src/lib/db/prisma";
import path from "path";
import { parseAndMapRealWorkbook } from "../src/lib/finance/real-bulk-importer";

async function runPhase8CTests() {
  console.log("==================================================================");
  console.log("PHASE 8C: MASTER MAPPING, REAL IMPORT & RECONCILIATION TEST SUITE");
  console.log("==================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  const realFilePath = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const parsedData = await parseAndMapRealWorkbook(realFilePath);

  // Test 1: 44 Recap Sheets Identified & Processed
  totalTests++;
  console.log(`[TEST 1] Source Recap Sheets Identified`);
  if (parsedData.recapSheetsCount === 44) {
    console.log(`  ✓ PASS: Exactly 44 recap sheets processed as financial transaction sources.`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: Expected 44 recap sheets, found ${parsedData.recapSheetsCount}`);
  }

  // Test 2: Multi-Item Vouchers (1 Batch -> N Items)
  totalTests++;
  console.log(`\n[TEST 2] Multi-Item Voucher Architecture`);
  const multiItemVouchers = parsedData.uniqueVouchers.filter((v) => v.items.length > 1);
  if (multiItemVouchers.length > 200) {
    console.log(`  ✓ PASS: Found ${multiItemVouchers.length} multi-item vouchers correctly grouped under 1 parent batch header.`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: Expected > 200 multi-item vouchers, got ${multiItemVouchers.length}`);
  }

  // Test 3: Project Mapping Coverage
  totalTests++;
  console.log(`\n[TEST 3] Master Project Mapping Coverage`);
  const projects = await prisma.project.findMany();
  const validProjectIds = new Set(projects.map((p) => p.id));
  const unmappedItems = parsedData.uniqueVouchers
    .flatMap((v) => v.items)
    .filter((it) => !validProjectIds.has(it.projectId));

  if (unmappedItems.length === 0) {
    console.log(`  ✓ PASS: 100% of candidate items mapped to valid Master Projects (0 unmapped).`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: Found ${unmappedItems.length} items with invalid/unmapped project.`);
  }

  // Test 4: PIC Mapping Coverage
  totalTests++;
  console.log(`\n[TEST 4] Master PIC Mapping Coverage`);
  const pics = await prisma.fieldPic.findMany();
  const validPicIds = new Set(pics.map((p) => p.id));
  const unmappedPicItems = parsedData.uniqueVouchers
    .flatMap((v) => v.items)
    .filter((it) => !validPicIds.has(it.picId));

  if (unmappedPicItems.length === 0) {
    console.log(`  ✓ PASS: 100% of candidate items mapped to valid Field PICs.`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: Found ${unmappedPicItems.length} items with invalid PIC.`);
  }

  // Test 5: Category Mapping Coverage
  totalTests++;
  console.log(`\n[TEST 5] Category Master Mapping Coverage`);
  const categories = await prisma.expenseCategory.findMany();
  const validCatIds = new Set(categories.map((c) => c.id));
  const unmappedCatItems = parsedData.uniqueVouchers
    .flatMap((v) => v.items)
    .filter((it) => !validCatIds.has(it.categoryId));

  if (unmappedCatItems.length === 0) {
    console.log(`  ✓ PASS: 100% of candidate items mapped to valid Expense Categories.`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: Found ${unmappedCatItems.length} items with invalid category.`);
  }

  // Test 6: Snapshot De-duplication Protection
  totalTests++;
  console.log(`\n[TEST 6] Snapshot De-duplication & Carried-Forward Handling`);
  const vouchersInMultipleSheets = parsedData.uniqueVouchers.filter((v) => v.sourceAppearances.length > 1);
  if (vouchersInMultipleSheets.length > 80) {
    console.log(`  ✓ PASS: ${vouchersInMultipleSheets.length} vouchers appearing across weekly sheets successfully de-duplicated into single canonical records.`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: Expected > 80 recurring vouchers, got ${vouchersInMultipleSheets.length}`);
  }

  // Test 7: Database Integrity & Active Totals Verification
  totalTests++;
  console.log(`\n[TEST 7] Database Invariants & Double-Entry Integrity`);
  const batchesCount = await prisma.submissionBatch.count();
  const itemsCount = await prisma.accExpenseItem.count();
  const postedJournals = await prisma.journalEntry.findMany({
    where: { status: "POSTED" },
    include: { lines: true },
  });

  let allJournalsBalanced = true;
  for (const j of postedJournals) {
    const totalDebit = j.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = j.lines.reduce((s, l) => s + Number(l.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      allJournalsBalanced = false;
      break;
    }
  }

  if (batchesCount > 0 && itemsCount > 0 && allJournalsBalanced) {
    console.log(`  ✓ PASS: Database contains ${batchesCount} batches and ${itemsCount} items; all ${postedJournals.length} POSTED journals are 100% balanced (Debit = Credit).`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: Integrity check failed. Batches: ${batchesCount}, Items: ${itemsCount}, Balanced: ${allJournalsBalanced}`);
  }

  console.log("\n==================================================================");
  console.log(`PHASE 8C TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("==================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase8CTests().catch(console.error).finally(() => prisma.$disconnect());
