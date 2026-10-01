import ExcelJS from "exceljs";
import path from "path";

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
  const filePath = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  let leftItemsCount = 0;
  let rightItemsCount = 0;
  const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;

  const leftNoKasSet = new Set<string>();
  const rightNoKasSet = new Set<string>();

  for (let idx = 0; idx < wb.worksheets.length; idx++) {
    const ws = wb.worksheets[idx];
    let isRecap = false;
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const row = ws.getRow(r);
      let rowJoined = "";
      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
        rowJoined += " " + getCellString(row.getCell(c));
      }
      if (rowJoined.toUpperCase().includes("REKAPAN PENGAJUAN") || rowJoined.toUpperCase().includes("POSISI KAS")) {
        isRecap = true;
        break;
      }
    }
    if (!isRecap) continue;

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);

      // Check col 2 (B)
      const bVal = getCellString(row.getCell(2));
      if (noKasRegex.test(bVal)) {
        leftItemsCount++;
        leftNoKasSet.add(bVal.toUpperCase());
      }

      // Check col 11 (K)
      const kVal = getCellString(row.getCell(11));
      if (noKasRegex.test(kVal)) {
        rightItemsCount++;
        rightNoKasSet.add(kVal.toUpperCase());
      }
    }
  }

  console.log(`Left Side (Col B) Items: ${leftItemsCount}, Unique No Kas: ${leftNoKasSet.size}`);
  console.log(`Right Side (Col K) Items: ${rightItemsCount}, Unique No Kas: ${rightNoKasSet.size}`);
  console.log(`Sum of both sides: ${leftItemsCount + rightItemsCount}`);
}

main().catch(console.error);
