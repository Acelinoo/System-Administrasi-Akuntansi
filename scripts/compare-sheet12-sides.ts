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

  console.log("Comparing Left side (A-H) vs Right side (J-Q) on Sheet 12:");
  let leftPengajuanTotal = 0;
  let rightPengajuanTotal = 0;
  let leftPencairanTotal = 0;
  let rightPencairanTotal = 0;
  let diffCount = 0;

  for (let r = 15; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const leftNoKas = getCellString(row.getCell(2)); // B
    const rightNoKas = getCellString(row.getCell(11)); // K

    if (!leftNoKas && !rightNoKas) continue;

    const leftDesc = getCellString(row.getCell(3));
    const leftPengajuan = parseFloat(getCellString(row.getCell(4)).replace(/[^0-9.-]/g, "") || "0");
    const leftPencairanSudah = parseFloat(getCellString(row.getCell(5)).replace(/[^0-9.-]/g, "") || "0");
    const leftPencairanCash = parseFloat(getCellString(row.getCell(6)).replace(/[^0-9.-]/g, "") || "0");
    const leftPencairanGiro = parseFloat(getCellString(row.getCell(7)).replace(/[^0-9.-]/g, "") || "0");
    const leftPencairanTrf = parseFloat(getCellString(row.getCell(8)).replace(/[^0-9.-]/g, "") || "0");

    const rightDesc = getCellString(row.getCell(12));
    const rightPengajuan = parseFloat(getCellString(row.getCell(13)).replace(/[^0-9.-]/g, "") || "0");
    const rightPencairanSudah = parseFloat(getCellString(row.getCell(14)).replace(/[^0-9.-]/g, "") || "0");
    const rightPencairanCash = parseFloat(getCellString(row.getCell(15)).replace(/[^0-9.-]/g, "") || "0");
    const rightPencairanGiro = parseFloat(getCellString(row.getCell(16)).replace(/[^0-9.-]/g, "") || "0");
    const rightPencairanTrf = parseFloat(getCellString(row.getCell(17)).replace(/[^0-9.-]/g, "") || "0");

    leftPengajuanTotal += isNaN(leftPengajuan) ? 0 : leftPengajuan;
    rightPengajuanTotal += isNaN(rightPengajuan) ? 0 : rightPengajuan;

    const leftPencairan = (leftPencairanSudah || 0) + (leftPencairanCash || 0) + (leftPencairanGiro || 0) + (leftPencairanTrf || 0);
    const rightPencairan = (rightPencairanSudah || 0) + (rightPencairanCash || 0) + (rightPencairanGiro || 0) + (rightPencairanTrf || 0);

    leftPencairanTotal += leftPencairan;
    rightPencairanTotal += rightPencairan;

    if (leftNoKas !== rightNoKas || leftPengajuan !== rightPengajuan || leftPencairan !== rightPencairan) {
      diffCount++;
      if (diffCount <= 5) {
        console.log(`Diff at row ${r}:`);
        console.log(`   LEFT:  NoKas=${leftNoKas}, Desc=${leftDesc}, Pengajuan=${leftPengajuan}, Pencairan=${leftPencairan}`);
        console.log(`   RIGHT: NoKas=${rightNoKas}, Desc=${rightDesc}, Pengajuan=${rightPengajuan}, Pencairan=${rightPencairan}`);
      }
    }
  }

  console.log(`\nTotals for Sheet 12:`);
  console.log(`Left  Pengajuan: ${leftPengajuanTotal}, Pencairan: ${leftPencairanTotal}`);
  console.log(`Right Pengajuan: ${rightPengajuanTotal}, Pencairan: ${rightPencairanTotal}`);
  console.log(`Total diff rows: ${diffCount}`);
}

main().catch(console.error);
