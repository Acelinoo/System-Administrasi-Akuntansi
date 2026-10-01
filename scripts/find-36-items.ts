import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { prisma } from "../src/lib/db/prisma";
import { parseAndMapRealWorkbook } from "../src/lib/finance/real-bulk-importer";

function getCellString(cell: ExcelJS.Cell): string {
  try {
    const val = cell.value;
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      const obj = val as unknown as Record<string, unknown>;
      if ("richText" in obj && Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text?: string }>).map((t) => t.text || "").join("").trim();
      }
      if ("text" in obj) return String(obj.text || "").trim();
      if ("result" in obj) return String(obj.result || "").trim();
    }
    return String(val).trim();
  } catch {
    return "";
  }
}

async function find36Items() {
  const targetFile = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(targetFile);

  // 1. Re-trace Phase 8B analyzer item extraction:
  // In Phase 8B (real-workbook-analyzer.ts):
  // When a No Kas was encountered:
  // desc = getCellString(row.getCell(c + 1));
  // if (!report.allFoundNoKas.has(normalizedNoKas)) {
  //   report.allFoundNoKas.set(normalizedNoKas, { count: 1, sheets: [sheetName], items: [desc] });
  // } else {
  //   ...
  //   if (desc && !existing.items.includes(desc)) {
  //     existing.items.push(desc);
  //   }
  // }
  // Wait! Did Phase 8B analyzer produce 994 items somewhere else?
  // Let's check: in Phase 8B, how did it get 994?
  // Let's check across all 44 recap sheets:
  // How many rows had Col B matching No Kas?
  // Or how many non-empty rows in Col B?
  // Or did Phase 8B parse only certain sheets?

  // Let's inspect the 1,030 imported items from Phase 8C in the database!
  // In the DB, there are 1,072 items total:
  // 42 pre-existing, 1,030 imported in Phase 8C!
  const dbItems = await prisma.accExpenseItem.findMany({
    where: {
      notes: { startsWith: "Sumber Excel:" }
    },
    include: {
      batch: true,
      project: true,
      category: true,
      pic: true,
      disbursementItems: true
    },
    orderBy: [{ noKas: "asc" }, { itemNo: "asc" }]
  });

  console.log(`Found ${dbItems.length} Real Excel imported items in DB.`);

  // Let's also check the 42 pre-existing items in DB:
  const preItems = await prisma.accExpenseItem.findMany({
    where: {
      NOT: { notes: { startsWith: "Sumber Excel:" } }
    },
    include: {
      batch: true,
      project: true,
      category: true,
      pic: true,
      disbursementItems: true
    },
    orderBy: [{ createdAt: "asc" }]
  });

  console.log(`Found ${preItems.length} Pre-existing items in DB.`);
  console.log(`Total: ${dbItems.length + preItems.length} (expected 1072)`);

  // Let's inspect preItems:
  console.log("\nPre-existing items summary:");
  const preByBatch = new Map<string, typeof preItems>();
  preItems.forEach(i => {
    const k = `${i.batch.batchCode} (${i.noKas})`;
    if (!preByBatch.has(k)) preByBatch.set(k, []);
    preByBatch.get(k)!.push(i);
  });

  let preTotalApproved = 0;
  let preTotalRealized = 0;
  preByBatch.forEach((items, batchKey) => {
    const batchApproved = items.reduce((s, it) => s + Number(it.approvedAmount), 0);
    const batchRealized = items.reduce((s, it) => s + it.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0), 0);
    preTotalApproved += batchApproved;
    preTotalRealized += batchRealized;
    console.log(`- ${batchKey}: ${items.length} items, Approved: Rp ${batchApproved.toLocaleString("id-ID")}, Realized: Rp ${batchRealized.toLocaleString("id-ID")}, Notes: ${items[0].batch.notes || items[0].notes || '-'}`);
  });

  console.log(`Pre-existing Total Approved: Rp ${preTotalApproved.toLocaleString("id-ID")}`);
  console.log(`Pre-existing Total Realized: Rp ${preTotalRealized.toLocaleString("id-ID")}`);

  // Now, what about the 15 collisions?
  // Which of these pre-existing batches correspond to the 15 collisions?
  // Let's check existingCollisions from real-bulk-importer:
  // When Phase 8C ran, what were the 15 collisions?
  const realExcelParsed = await parseAndMapRealWorkbook(targetFile);
  const excelNoKasSet = new Set(realExcelParsed.uniqueVouchers.map(v => v.noKas.toUpperCase()));

  const collidingPreBatches = Array.from(preByBatch.entries()).filter(([batchKey, items]) => {
    return items.some(i => excelNoKasSet.has(i.noKas.toUpperCase()));
  });

  console.log(`\nPre-existing batches that match Excel No Kas (${collidingPreBatches.length}):`);
  let collidingApproved = 0;
  let collidingRealized = 0;
  let collidingItemCount = 0;
  collidingPreBatches.forEach(([batchKey, items]) => {
    const bApp = items.reduce((s, it) => s + Number(it.approvedAmount), 0);
    const bReal = items.reduce((s, it) => s + it.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0), 0);
    collidingApproved += bApp;
    collidingRealized += bReal;
    collidingItemCount += items.length;
    console.log(`  * ${batchKey}: ${items.length} items, App: Rp ${bApp.toLocaleString("id-ID")}, Real: Rp ${bReal.toLocaleString("id-ID")}`);
  });
  console.log(`Colliding totals: ${collidingItemCount} items, Approved: Rp ${collidingApproved.toLocaleString("id-ID")}, Realized: Rp ${collidingRealized.toLocaleString("id-ID")}`);

  // Non-colliding pre-existing batches (pure test/synthetic batches):
  const pureTestPreBatches = Array.from(preByBatch.entries()).filter(([batchKey, items]) => {
    return !items.some(i => excelNoKasSet.has(i.noKas.toUpperCase()));
  });

  console.log(`\nPure test pre-existing batches (${pureTestPreBatches.length}):`);
  let testApproved = 0;
  let testRealized = 0;
  let testItemCount = 0;
  pureTestPreBatches.forEach(([batchKey, items]) => {
    const bApp = items.reduce((s, it) => s + Number(it.approvedAmount), 0);
    const bReal = items.reduce((s, it) => s + it.disbursementItems.reduce((ds, d) => ds + Number(d.realizedAmount), 0), 0);
    testApproved += bApp;
    testRealized += bReal;
    testItemCount += items.length;
    console.log(`  * ${batchKey}: ${items.length} items, App: Rp ${bApp.toLocaleString("id-ID")}, Real: Rp ${bReal.toLocaleString("id-ID")}`);
  });
  console.log(`Pure test totals: ${testItemCount} items, Approved: Rp ${testApproved.toLocaleString("id-ID")}, Realized: Rp ${testRealized.toLocaleString("id-ID")}`);

  fs.writeFileSync("find-36-output.json", JSON.stringify({
    dbItemsCount: dbItems.length,
    preItemsCount: preItems.length,
    collidingItemCount,
    collidingApproved,
    collidingRealized,
    testItemCount,
    testApproved,
    testRealized,
    preTotalApproved,
    preTotalRealized
  }, null, 2));
}

find36Items().catch(console.error).finally(() => prisma.$disconnect());
