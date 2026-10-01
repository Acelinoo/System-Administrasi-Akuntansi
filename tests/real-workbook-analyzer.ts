import ExcelJS from "exceljs";
import path from "path";

export interface WorkbookAnalysisReport {
  fileName: string;
  totalSheets: number;
  recapSheets: Array<{
    sheetIndex: number;
    sheetName: string;
    dateBlocks: string[];
    noKasCount: number;
    rowCount: number;
  }>;
  detailSheets: Array<{
    sheetIndex: number;
    sheetName: string;
    pics: string[];
    rowCount: number;
  }>;
  specialSheets: Array<{
    sheetIndex: number;
    sheetName: string;
    rowCount: number;
  }>;
  allFoundNoKas: Map<string, { count: number; sheets: string[]; items: string[] }>;
  noKasWithMultipleItems: Array<{ noKas: string; itemCount: number; sampleItems: string[] }>;
  candidateProjects: Set<string>;
  candidateCategories: Set<string>;
  candidatePics: Set<string>;
  totalPengajuanNominal: number;
  totalAccNominal: number;
  totalPencairanNominal: number;
  snapshotsDetected: Array<{ noKas: string; occurrences: number; sheets: string[] }>;
}

function getCellString(cell: ExcelJS.Cell): string {
  try {
    const val = cell.value;
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      const obj = val as unknown as Record<string, unknown>;
      if ("richText" in obj && Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text?: string }>).map((t) => t.text || "").join("").trim();
      }
      if ("text" in obj) {
        return String(obj.text || "").trim();
      }
      if ("result" in obj) {
        return String(obj.result || "").trim();
      }
    }
    return String(val).trim();
  } catch {
    return "";
  }
}

export async function analyzeRealWorkbook(filePath: string): Promise<WorkbookAnalysisReport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const report: WorkbookAnalysisReport = {
    fileName: path.basename(filePath),
    totalSheets: workbook.worksheets.length,
    recapSheets: [],
    detailSheets: [],
    specialSheets: [],
    allFoundNoKas: new Map(),
    noKasWithMultipleItems: [],
    candidateProjects: new Set(),
    candidateCategories: new Set(),
    candidatePics: new Set(),
    totalPengajuanNominal: 0,
    totalAccNominal: 0,
    totalPencairanNominal: 0,
    snapshotsDetected: [],
  };

  for (let idx = 0; idx < workbook.worksheets.length; idx++) {
    const ws = workbook.worksheets[idx];
    const sheetName = ws.name.trim();

    let isRecap = false;
    let isDetail = false;
    const dateBlocks: string[] = [];
    const detailPics: string[] = [];

    // Scan first 15 rows to classify sheet
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const row = ws.getRow(r);
      let rowJoined = "";
      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
        rowJoined += " " + getCellString(row.getCell(c));
      }
      const upperRow = rowJoined.toUpperCase();

      if (upperRow.includes("REKAPAN PENGAJUAN") || upperRow.includes("POSISI KAS")) {
        isRecap = true;
      }
      if (upperRow.includes("PER TANGGAL")) {
        for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
          const val = getCellString(row.getCell(c));
          if (val.toUpperCase().startsWith("PER TANGGAL")) {
            dateBlocks.push(val);
          }
        }
      }

      if (
        upperRow.includes("PA HERI") ||
        upperRow.includes("PA DEDI") ||
        upperRow.includes("PA MAMAT") ||
        upperRow.includes("PA UDEN") ||
        upperRow.includes("PA ENGKUS")
      ) {
        if (!isRecap) {
          isDetail = true;
          for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
            const val = getCellString(row.getCell(c));
            if (
              val.toUpperCase().includes("HERI") ||
              val.toUpperCase().includes("DEDI") ||
              val.toUpperCase().includes("MAMAT") ||
              val.toUpperCase().includes("NISA") ||
              val.toUpperCase().includes("UDEN") ||
              val.toUpperCase().includes("ENGKUS")
            ) {
              detailPics.push(val);
            }
          }
        }
      }
    }

    if (isRecap) {
      let sheetNoKasCount = 0;
      const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;

      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const maxCol = Math.min(ws.columnCount, 50);

        for (let c = 1; c <= maxCol; c++) {
          const cellStr = getCellString(row.getCell(c));
          if (noKasRegex.test(cellStr)) {
            sheetNoKasCount++;
            const normalizedNoKas = cellStr.toUpperCase();

            const desc = getCellString(row.getCell(c + 1));
            const pengajuan = parseFloat(getCellString(row.getCell(c + 2)).replace(/[^0-9.-]/g, "") || "0");
            const pencairan = parseFloat(getCellString(row.getCell(c + 3)).replace(/[^0-9.-]/g, "") || "0");

            if (!report.allFoundNoKas.has(normalizedNoKas)) {
              report.allFoundNoKas.set(normalizedNoKas, { count: 1, sheets: [sheetName], items: [desc] });
            } else {
              const existing = report.allFoundNoKas.get(normalizedNoKas)!;
              existing.count++;
              if (!existing.sheets.includes(sheetName)) {
                existing.sheets.push(sheetName);
              }
              if (desc && !existing.items.includes(desc)) {
                existing.items.push(desc);
              }
            }

            if (!isNaN(pengajuan) && pengajuan > 0) {
              report.totalPengajuanNominal += pengajuan;
            }
            if (!isNaN(pencairan) && pencairan > 0) {
              report.totalPencairanNominal += pencairan;
            }

            const upperDesc = desc.toUpperCase();
            if (upperDesc.includes("ALCENT") || upperDesc.includes("SMP") || upperDesc.includes("SMA") || upperDesc.includes("SD") || upperDesc.includes("TK")) {
              report.candidateProjects.add("ALCENT");
            }
            if (upperDesc.includes("SUMEDANG")) report.candidateProjects.add("SUMEDANG");
            if (upperDesc.includes("KAWALUYAAN")) report.candidateProjects.add("KAWALUYAAN");
            if (upperDesc.includes("RT BU ANI") || upperDesc.includes("BU ANI")) report.candidateProjects.add("RT_BU_ANI");
            if (upperDesc.includes("TANGGERANG")) report.candidateProjects.add("TANGGERANG");
            if (upperDesc.includes("ANTAPANI")) report.candidateProjects.add("ANTAPANI (Candidate)");
            if (upperDesc.includes("BUDI INDAH") || upperDesc.includes("BD INDAH")) report.candidateProjects.add("BUDI_INDAH (Candidate)");
            if (upperDesc.includes("JL GITAR") || upperDesc.includes("GITAR")) report.candidateProjects.add("JL_GITAR (Candidate)");
            if (upperDesc.includes("DARUL ULUM")) report.candidateProjects.add("DARUL_ULUM (Candidate)");
            if (upperDesc.includes("UPI")) report.candidateProjects.add("UPI (Candidate)");
            if (upperDesc.includes("CIREBON")) report.candidateProjects.add("CIREBON (Candidate)");

            if (upperDesc.includes("UPAH") || upperDesc.includes("TUKANG") || upperDesc.includes("MANDOR")) report.candidateCategories.add("UPAH");
            if (upperDesc.includes("MATERIAL") || upperDesc.includes("MATRIAL") || upperDesc.includes("SEMEN") || upperDesc.includes("CAT") || upperDesc.includes("BESI")) report.candidateCategories.add("MATERIAL");
            if (upperDesc.includes("BPJS")) report.candidateCategories.add("BPJS (OPS_KANTOR)");
            if (upperDesc.includes("LISTRIK")) report.candidateCategories.add("LISTRIK (OPS_KANTOR)");
            if (upperDesc.includes("TLP") || upperDesc.includes("INTERNET")) report.candidateCategories.add("INTERNET (OPS_KANTOR)");
            if (upperDesc.includes("ATK") || upperDesc.includes("PRINT") || upperDesc.includes("TINTA")) report.candidateCategories.add("ATK (OPS_KANTOR)");
            if (upperDesc.includes("KONTRABON") || upperDesc.includes("RESTULOGAM") || upperDesc.includes("TOKO")) report.candidateCategories.add("KONTRABON");
            if (upperDesc.includes("KASBON") || upperDesc.includes("CASH BON")) report.candidateCategories.add("KASBON");
            if (upperDesc.includes("SEWA") || upperDesc.includes("SCAFOLDING")) report.candidateCategories.add("SEWA_ALAT");
            if (upperDesc.includes("BBM") || upperDesc.includes("TOL") || upperDesc.includes("PARKIR")) report.candidateCategories.add("BBM_TOL (OPS_LAPANGAN)");
            if (upperDesc.includes("KEAMANAN") || upperDesc.includes("SATPAM")) report.candidateCategories.add("KEAMANAN (OPS_LAPANGAN)");
          }
        }
      }

      report.recapSheets.push({
        sheetIndex: idx + 1,
        sheetName,
        dateBlocks: Array.from(new Set(dateBlocks)),
        noKasCount: sheetNoKasCount,
        rowCount: ws.rowCount,
      });
    } else if (isDetail) {
      report.detailSheets.push({
        sheetIndex: idx + 1,
        sheetName,
        pics: Array.from(new Set(detailPics)),
        rowCount: ws.rowCount,
      });
    } else {
      report.specialSheets.push({
        sheetIndex: idx + 1,
        sheetName,
        rowCount: ws.rowCount,
      });
    }
  }

  report.allFoundNoKas.forEach((data, noKas) => {
    if (data.items.length > 1) {
      report.noKasWithMultipleItems.push({
        noKas,
        itemCount: data.items.length,
        sampleItems: data.items.slice(0, 5),
      });
    }
    if (data.sheets.length > 1) {
      report.snapshotsDetected.push({
        noKas,
        occurrences: data.count,
        sheets: data.sheets,
      });
    }
  });

  return report;
}

if (require.main === module) {
  const targetFile = path.join(process.cwd(), "Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  console.log("Analyzing Real Workbook:", targetFile);

  analyzeRealWorkbook(targetFile)
    .then((report) => {
      console.log("\n=======================================================");
      console.log("REAL WORKBOOK AUDIT RESULTS SUMMARY");
      console.log("=======================================================");
      console.log(`File Name:               ${report.fileName}`);
      console.log(`Total Worksheets:        ${report.totalSheets}`);
      console.log(`Recap Sheets (Type A):   ${report.recapSheets.length}`);
      console.log(`Detail Sheets (Type B):  ${report.detailSheets.length}`);
      console.log(`Special / Other Sheets:  ${report.specialSheets.length}`);
      console.log(`Unique No Kas Found:     ${report.allFoundNoKas.size}`);
      console.log(`No Kas with Multiple Items: ${report.noKasWithMultipleItems.length}`);
      console.log(`Snapshots Across Sheets: ${report.snapshotsDetected.length}`);

      console.log("\n--- SAMPLE NO KAS WITH MULTIPLE ITEMS (1 BATCH -> N ITEMS) ---");
      report.noKasWithMultipleItems.slice(0, 10).forEach((item) => {
        console.log(`* ${item.noKas} (${item.itemCount} items): ${item.sampleItems.join(" | ")}`);
      });

      console.log("\n--- SAMPLE WEEKLY SNAPSHOT REPETITIONS (SAME NO KAS IN MULTIPLE SHEETS) ---");
      report.snapshotsDetected.slice(0, 10).forEach((s) => {
        console.log(`* ${s.noKas} appears ${s.occurrences}x across ${s.sheets.length} sheets: [${s.sheets.slice(0, 5).join(", ")}${s.sheets.length > 5 ? "..." : ""}]`);
      });

      console.log("\n--- CANDIDATE PROJECTS DETECTED ---");
      console.log(Array.from(report.candidateProjects).join(", "));

      console.log("\n--- CANDIDATE CATEGORIES DETECTED ---");
      console.log(Array.from(report.candidateCategories).join(", "));
    })
    .catch((err) => {
      console.error("Analysis failed:", err);
      process.exit(1);
    });
}
