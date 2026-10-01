import ExcelJS from "exceljs";
import path from "path";

async function deepInspect() {
  const filePath = path.join(process.cwd(), "Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Inspect 2 JULI further down (rows 25-100)
  const ws2Juli = workbook.getWorksheet("2 JULI")!;
  console.log("=== 2 JULI (Rows 25 - 90) ===");
  for (let r = 25; r <= 80; r++) {
    const row = ws2Juli.getRow(r);
    const txts: string[] = [];
    let has = false;
    for (let c = 1; c <= 18; c++) {
      const val = row.getCell(c).text?.trim() || "";
      if (val) has = true;
      txts.push(val);
    }
    if (has) {
      console.log(`R${r.toString().padStart(2, "0")}: ${txts.join(" | ")}`);
    }
  }

  // Inspect what the even/odd sheets are (e.g. Sheet43, Sheet44, Sheet2, etc.)
  const sampleOtherSheets = ["Tgl 9", "Sheet2", "Sheet43", "Sheet44", "Sheet55"];
  for (const name of sampleOtherSheets) {
    const ws = workbook.getWorksheet(name);
    if (!ws) continue;
    console.log(`\n=== SHEET: ${name} (Rows: ${ws.rowCount}, Cols: ${ws.columnCount}) ===`);
    for (let r = 1; r <= 15; r++) {
      const row = ws.getRow(r);
      const txts: string[] = [];
      let has = false;
      for (let c = 1; c <= 12; c++) {
        const val = row.getCell(c).text?.trim() || "";
        if (val) has = true;
        txts.push(val);
      }
      if (has) {
        console.log(`R${r.toString().padStart(2, "0")}: ${txts.join(" | ")}`);
      }
    }
  }
}

deepInspect().catch(console.error);
