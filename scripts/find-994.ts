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

async function find994() {
  const targetFile = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(targetFile);

  const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;

  // Let's test various candidate item counting logics:
  // 1. In real-workbook-analyzer.ts:
  // Map of unique descriptions per No Kas:
  const noKasDescMap = new Map<string, Set<string>>();
  // Map of unique (noKas, desc) with non-empty desc:
  let rawColBRows = 0;
  let rawColBWithDesc = 0;
  let rawColBWithAmount = 0;

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
      const bVal = getCellString(row.getCell(2));
      if (noKasRegex.test(bVal)) {
        rawColBRows++;
        const noKas = bVal.toUpperCase();
        const desc = getCellString(row.getCell(3));
        const pengajuan = parseFloat(getCellString(row.getCell(4)).replace(/[^0-9.-]/g, "") || "0");
        if (desc) rawColBWithDesc++;
        if (!isNaN(pengajuan) && pengajuan > 0) rawColBWithAmount++;

        if (!noKasDescMap.has(noKas)) noKasDescMap.set(noKas, new Set());
        if (desc) noKasDescMap.get(noKas)!.add(desc);
      }
    }
  }

  let totalUniqueDescPerNoKas = 0;
  noKasDescMap.forEach((descs) => {
    totalUniqueDescPerNoKas += descs.size;
  });

  console.log({
    rawColBRows,
    rawColBWithDesc,
    rawColBWithAmount,
    totalUniqueDescPerNoKas,
  });

  // What about if we only take unique descriptions across all sheets without No Kas?
  // What about if we check all columns?
  const allColsNoKasDescMap = new Map<string, Set<string>>();
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
      for (let c = 1; c <= Math.min(ws.columnCount, 50); c++) {
        const val = getCellString(row.getCell(c));
        if (noKasRegex.test(val)) {
          const noKas = val.toUpperCase();
          const desc = getCellString(row.getCell(c + 1));
          if (!allColsNoKasDescMap.has(noKas)) allColsNoKasDescMap.set(noKas, new Set());
          if (desc) allColsNoKasDescMap.get(noKas)!.add(desc);
        }
      }
    }
  }

  let totalAllColsUniqueDesc = 0;
  allColsNoKasDescMap.forEach((descs) => {
    totalAllColsUniqueDesc += descs.size;
  });
  console.log({ totalAllColsUniqueDesc });
}

find994().catch(console.error);
