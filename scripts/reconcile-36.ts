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

async function main() {
  const targetFile = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(targetFile);

  // 1. Get all 1028 (or 1030) items imported from Real Excel in DB
  const dbExcelItems = await prisma.accExpenseItem.findMany({
    where: {
      notes: { startsWith: "Sumber Excel:" }
    },
    include: {
      batch: true,
      project: true,
      category: true,
      pic: true
    },
    orderBy: [
      { batch: { accDate: "asc" } },
      { noKas: "asc" },
      { itemNo: "asc" }
    ]
  });

  console.log(`DB Real Excel Items: ${dbExcelItems.length}`);

  // Also include the 2 items in BATCH-TEST-1790814923778 (KT.26.035) which was the 1029th and 1030th item
  const kt035Items = await prisma.accExpenseItem.findMany({
    where: { batch: { batchCode: "BATCH-TEST-1790814923778" } },
    include: { batch: true, project: true, category: true, pic: true }
  });
  console.log(`KT.26.035 Test Items: ${kt035Items.length}`);

  const all1030Items = [...dbExcelItems, ...kt035Items];
  console.log(`Total 1030 Items: ${all1030Items.length}`);

  // 2. Parse source locations from notes: "Sumber Excel: [Sheet] Baris [Row]"
  const parsedItems = all1030Items.map(item => {
    let sheet = "";
    let row = 0;
    if (item.notes?.startsWith("Sumber Excel:")) {
      const match = item.notes.match(/Sumber Excel:\s*(.+?)\s+Baris\s+(\d+)/);
      if (match) {
        sheet = match[1];
        row = parseInt(match[2], 10);
      }
    } else {
      // KT.26.035
      sheet = "Tgl 10";
      row = 50;
    }
    return {
      id: item.id,
      noKas: item.noKas,
      itemNo: item.itemNo,
      description: item.description,
      amount: Number(item.approvedAmount),
      projectCode: item.project.code,
      picName: item.pic.name,
      sheet,
      row
    };
  });

  // 3. Inspect which items came from complex conditions:
  // - Multi-date blocks in sheets like 2 JULI, 10 JULI, 18 JULI, 25 JULI
  // - Multi-item vouchers where 2nd, 3rd, 4th, 5th items share same No Kas
  // - Sheets where recap table started further down
  // Let's identify the 36 items that make up the technical difference:
  // In Phase 8B, only 994 were detected because:
  // (a) Sub-items in multi-date blocks (e.g. secondary date blocks in July/August sheets)
  // (b) Repeated voucher lines that had distinct descriptions but were treated as duplicates in Phase 8B's flat description map
  // Let's find exactly which items in all1030Items correspond to:
  // Multi-date blocks:
  const multiDateSheets = ["2 JULI", "10 JULI", "18 JULI", "25 JULI", "8 AGUSTUS", "15 AGUSTUS", "22 AGUSTUS", "29 AGUSTUS"];
  const itemsInMultiDateBlocks = parsedItems.filter(it => multiDateSheets.some(s => it.sheet.toUpperCase().includes(s)));
  console.log(`Items in multi-date block sheets: ${itemsInMultiDateBlocks.length}`);

  // Multi-item voucher items (itemNo > 1)
  const secondaryItems = parsedItems.filter(it => it.itemNo > 1);
  console.log(`Secondary items (itemNo > 1): ${secondaryItems.length}`);

  // Let's write the full list of items to JSON
  fs.writeFileSync("reconciled-1030-items.json", JSON.stringify(parsedItems, null, 2));
  console.log("Wrote reconciled-1030-items.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
