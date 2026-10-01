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

// Look at creation timestamps:
const byMinute = new Map<string, BatchInfo[]>();
batches.forEach((b) => {
  const min = b.createdAt.slice(0, 16); // YYYY-MM-DDTHH:mm
  if (!byMinute.has(min)) byMinute.set(min, []);
  byMinute.get(min)!.push(b);
});

console.log("Batches by minute of creation:");
byMinute.forEach((list, min) => {
  const sumApp = list.reduce((s, b) => s + b.totalApproved, 0);
  const sumItems = list.reduce((s, b) => s + b.itemCount, 0);
  console.log(`- ${min}: ${list.length} batches, ${sumItems} items, Rp ${sumApp.toLocaleString("id-ID")}`);
});

// Which batches are pre-existing vs real excel import?
// In Phase 8C, import was executed on 2026-10-01 around a specific time.
// Let's inspect the earliest batches:
console.log("\nEarliest 25 batches in database:");
batches.slice(0, 25).forEach((b, idx) => {
  console.log(
    `[${idx + 1}] Code: ${b.batchCode.padEnd(25)} | NoKas: ${(b.noKas || "-").padEnd(12)} | Items: ${b.itemCount} | App: Rp ${b.totalApproved.toLocaleString("id-ID").padStart(12)} | Created: ${b.createdAt} | Note: ${b.notes || b.sampleItemNotes || "-"}`
  );
});

// Let's check the latest 5 batches:
console.log("\nLatest 5 batches in database:");
batches.slice(-5).forEach((b, idx) => {
  console.log(
    `[${idx + 1}] Code: ${b.batchCode.padEnd(25)} | NoKas: ${(b.noKas || "-").padEnd(12)} | Items: ${b.itemCount} | App: Rp ${b.totalApproved.toLocaleString("id-ID").padStart(12)} | Created: ${b.createdAt} | Note: ${b.notes || b.sampleItemNotes || "-"}`
  );
});
