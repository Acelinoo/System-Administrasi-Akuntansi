import ExcelJS from "exceljs";
import path from "path";

async function analyzeWorkbook() {
  const filePath = path.join(process.cwd(), "Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  console.log("Analyzing:", filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log("Total Worksheets:", workbook.worksheets.length);

  const sheetsSummary: Array<{
    index: number;
    name: string;
    rowCount: number;
    colCount: number;
  }> = [];

  workbook.worksheets.forEach((ws, idx) => {
    sheetsSummary.push({
      index: idx + 1,
      name: ws.name,
      rowCount: ws.rowCount,
      colCount: ws.columnCount,
    });
  });

  console.log("\nSheet Names:");
  sheetsSummary.forEach((s) => {
    console.log(`[${s.index}] ${s.name} (Rows: ${s.rowCount}, Cols: ${s.colCount})`);
  });

  // Let's sample a few recap sheets and detail sheets
  const sampleSheets = ["2 JULI", "REKAP", "PA HERI", "15 JANUARI", "16 JAN"];
  for (const name of sampleSheets) {
    const ws = workbook.getWorksheet(name) || workbook.worksheets.find(w => w.name.toLowerCase().includes(name.toLowerCase()));
    if (ws) {
      console.log(`\n======================================================`);
      console.log(`SAMPLE SHEET: ${ws.name} (Rows: ${ws.rowCount})`);
      console.log(`======================================================`);
      // Print first 25 non-empty rows
      let printed = 0;
      for (let r = 1; r <= Math.min(ws.rowCount, 40) && printed < 25; r++) {
        const row = ws.getRow(r);
        const values: string[] = [];
        let hasContent = false;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 20) {
            const txt = cell.text?.trim() || "";
            if (txt) hasContent = true;
            values.push(txt.replace(/\n/g, " "));
          }
        });
        if (hasContent) {
          console.log(`R${r.toString().padStart(2, "0")}: ${values.join(" | ")}`);
          printed++;
        }
      }
    }
  }
}

analyzeWorkbook().catch(console.error);
