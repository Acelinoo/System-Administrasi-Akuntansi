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

  const ws = wb.getWorksheet("Sheet 12") || wb.worksheets[0];
  console.log(`Inspecting Worksheet: ${ws.name}`);

  for (let r = 1; r <= 20; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= 20; c++) {
      const s = getCellString(row.getCell(c));
      cells.push(`[Col ${c} (${String.fromCharCode(64 + c)})]: ${s}`);
    }
    const nonEmp = cells.filter((c) => !c.endsWith(": "));
    if (nonEmp.length > 0) {
      console.log(`Row ${r}: ${nonEmp.join(" | ")}`);
    }
  }
}

main().catch(console.error);
