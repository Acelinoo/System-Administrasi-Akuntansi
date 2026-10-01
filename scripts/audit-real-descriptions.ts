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

async function audit() {
  const filePath = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const matchedKeywords = new Map<string, Array<{ sheet: string; noKas: string; desc: string; amount: number; pencairan: number }>>();
  const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;

  for (let idx = 0; idx < wb.worksheets.length; idx++) {
    const ws = wb.worksheets[idx];
    const sheetName = ws.name.trim();

    // Check if recap sheet
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
      for (let c = 1; c <= Math.min(ws.columnCount, 50); c++) {
        const cellStr = getCellString(row.getCell(c));
        if (noKasRegex.test(cellStr)) {
          const noKas = cellStr.toUpperCase();
          const desc = getCellString(row.getCell(c + 1));
          const pengajuan = parseFloat(getCellString(row.getCell(c + 2)).replace(/[^0-9.-]/g, "") || "0");
          const pencairan = parseFloat(getCellString(row.getCell(c + 3)).replace(/[^0-9.-]/g, "") || "0");

          const keywords = [
            "DARUL ULUM", "BUDI INDAH", "BD INDAH", "APARTEMEN", "KAWALUYAAN",
            "TANGGERANG", "TANGERANG", "ANTAPANI", "UPI", "RT BU ANI", "BU ANI",
            "CIREBON", "GITAR", "SUMEDANG", "ALCENT", "AL-CENT", "SMA", "SMP", "SD", "TK"
          ];

          for (const kw of keywords) {
            if (desc.toUpperCase().includes(kw)) {
              if (!matchedKeywords.has(kw)) matchedKeywords.set(kw, []);
              matchedKeywords.get(kw)!.push({ sheet: sheetName, noKas, desc, amount: pengajuan, pencairan });
            }
          }
        }
      }
    }
  }

  console.log("=== KEYWORD OCCURRENCES ACROSS 44 RECAP SHEETS ===");
  for (const [kw, occurrences] of matchedKeywords.entries()) {
    console.log(`Keyword: ${kw} -> ${occurrences.length} matches`);
    // print first 3 samples
    occurrences.slice(0, 3).forEach((o) => {
      console.log(`   [${o.sheet}] ${o.noKas}: ${o.desc} (Pengajuan: ${o.amount}, Pencairan: ${o.pencairan})`);
    });
  }
}

audit().catch(console.error);
