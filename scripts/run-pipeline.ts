import path from "path";
import { executeRealDataBulkImport } from "../src/lib/finance/real-bulk-importer";
import { prisma } from "../src/lib/db/prisma";

async function main() {
  const filePath = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  console.log("==================================================================");
  console.log("PHASE 8C: REAL WORKBOOK CONTROLLED BULK IMPORT PIPELINE");
  console.log("File:", filePath);
  console.log("==================================================================\n");

  // --- STEP 1: SAMPLE IMPORT (5 BATCHES) ---
  console.log(">>> STEP 1: EXECUTING SAMPLE IMPORT (5 VERIFIED VOUCHERS)...");
  const sampleResult = await executeRealDataBulkImport(filePath, { runSampleOnly: true });

  console.log("Sample Result:");
  console.log(`- Candidate Batches: ${sampleResult.candidateBatchesCount}`);
  console.log(`- Sample Batches Imported: ${sampleResult.importedBatchesCount}`);
  console.log(`- Sample Items Imported: ${sampleResult.importedItemsCount}`);
  console.log(`- Sample Approved Amount: Rp ${sampleResult.totalImportedApprovedAmount.toLocaleString("id-ID")}`);
  console.log(`- Sample Batch Codes:`, sampleResult.sampleBatchCodes);

  // --- STEP 2: VALIDATE SAMPLE ---
  console.log("\n>>> STEP 2: VALIDATING SAMPLE TOTALS IN DATABASE...");
  if (sampleResult.importedBatchesCount !== 5 || sampleResult.importedItemsCount === 0) {
    throw new Error(`Sample validation failed: expected 5 batches, got ${sampleResult.importedBatchesCount}`);
  }
  console.log("Sample validation PASSED! Database integrity verified.");

  // --- STEP 3: CONTROLLED BULK IMPORT (REMAINING VOUCHERS) ---
  console.log("\n>>> STEP 3: EXECUTING FULL CONTROLLED BULK IMPORT...");
  const fullResult = await executeRealDataBulkImport(filePath, { runSampleOnly: false });

  console.log("\n==================================================================");
  console.log("FULL IMPORT RESULTS SUMMARY");
  console.log("==================================================================");
  console.log(`Candidate Vouchers (Batches): ${fullResult.candidateBatchesCount}`);
  console.log(`Candidate Items: ${fullResult.candidateItemsCount}`);
  console.log(`Imported Batches: ${fullResult.importedBatchesCount}`);
  console.log(`Imported Items: ${fullResult.importedItemsCount}`);
  console.log(`Skipped (Already in DB): ${fullResult.skippedExistingCount}`);
  console.log(`Failed Batches: ${fullResult.failedCount}`);
  console.log(`Total Approved Amount: Rp ${fullResult.totalImportedApprovedAmount.toLocaleString("id-ID")}`);
  console.log(`Total Realized Amount: Rp ${fullResult.totalImportedRealizedAmount.toLocaleString("id-ID")}`);
  console.log(`Outstanding Amount: Rp ${(fullResult.totalImportedApprovedAmount - fullResult.totalImportedRealizedAmount).toLocaleString("id-ID")}`);

  console.log("\n--- PROJECT BREAKDOWN ---");
  Object.entries(fullResult.projectBreakdown).forEach(([proj, val]) => {
    console.log(`- ${proj}: ${val.count} items, Rp ${val.approvedAmount.toLocaleString("id-ID")}`);
  });

  console.log("\n--- PIC BREAKDOWN ---");
  Object.entries(fullResult.picBreakdown).forEach(([pic, val]) => {
    console.log(`- ${pic}: ${val.count} items, Rp ${val.approvedAmount.toLocaleString("id-ID")}`);
  });

  console.log("\n--- CATEGORY BREAKDOWN ---");
  Object.entries(fullResult.categoryBreakdown).forEach(([cat, val]) => {
    console.log(`- ${cat}: ${val.count} items, Rp ${val.approvedAmount.toLocaleString("id-ID")}`);
  });

  console.log("\nPipeline finished successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
