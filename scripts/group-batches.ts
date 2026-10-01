import fs from "fs";

interface BatchInfo {
  id: string;
  batchCode: string;
  noKas: string | null;
  accDate: string;
  approvedByName: string;
  notes: string | null;
  createdAt: string;
  itemCount: number;
  totalApproved: number;
  totalRealized: number;
  sampleItemNotes: string | null;
}

const batches: BatchInfo[] = JSON.parse(fs.readFileSync("all-batches-dump.json", "utf8"));

const realExcelBatches = batches.filter((b) => b.notes?.startsWith("Impor Real Excel"));
const nonExcelBatches = batches.filter((b) => !b.notes?.startsWith("Impor Real Excel"));

console.log(`Real Excel Batches: ${realExcelBatches.length}`);
console.log(`Non-Excel / Test Batches: ${nonExcelBatches.length}`);
console.log(`Total Batches: ${batches.length}`);

const realItemsCount = realExcelBatches.reduce((s, b) => s + b.itemCount, 0);
const realApproved = realExcelBatches.reduce((s, b) => s + b.totalApproved, 0);
const realRealized = realExcelBatches.reduce((s, b) => s + b.totalRealized, 0);

const nonExcelItemsCount = nonExcelBatches.reduce((s, b) => s + b.itemCount, 0);
const nonExcelApproved = nonExcelBatches.reduce((s, b) => s + b.totalApproved, 0);
const nonExcelRealized = nonExcelBatches.reduce((s, b) => s + b.totalRealized, 0);

console.log(`\nReal Excel Items: ${realItemsCount}`);
console.log(`Real Excel Approved: Rp ${realApproved.toLocaleString("id-ID")}`);
console.log(`Real Excel Realized: Rp ${realRealized.toLocaleString("id-ID")}`);

console.log(`\nNon-Excel / Test Items: ${nonExcelItemsCount}`);
console.log(`Non-Excel / Test Approved: Rp ${nonExcelApproved.toLocaleString("id-ID")}`);
console.log(`Non-Excel / Test Realized: Rp ${nonExcelRealized.toLocaleString("id-ID")}`);

console.log(`\nTotal Database Items: ${realItemsCount + nonExcelItemsCount}`);
console.log(`Total Database Approved: Rp ${(realApproved + nonExcelApproved).toLocaleString("id-ID")}`);
console.log(`Total Database Realized: Rp ${(realRealized + nonExcelRealized).toLocaleString("id-ID")}`);

console.log("\n--- DETAILED BREAKDOWN OF NON-EXCEL / TEST BATCHES ---");
nonExcelBatches.forEach((b, idx) => {
  console.log(
    `[${(idx + 1).toString().padStart(2, "0")}] Code: ${b.batchCode.padEnd(25)} | NoKas: ${(b.noKas || "-").padEnd(10)} | Items: ${b.itemCount} | Approved: Rp ${b.totalApproved.toLocaleString("id-ID").padStart(12)} | Note: ${b.notes || "-"}`
  );
});
