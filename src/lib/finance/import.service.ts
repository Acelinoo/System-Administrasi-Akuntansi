import ExcelJS from "exceljs";
import { prisma } from "../db/prisma";
import { CashType, Prisma } from "@prisma/client";
import { createSubmissionBatch } from "./acc.service";
import { isValidNoKasFormat } from "./no-kas";
import { parseAndMapRealWorkbook } from "./real-bulk-importer";

export interface ImportIssue {
  row: number;
  field: string;
  value: string;
  problem: string;
}

export interface ParsedImportRow {
  rowNumber: number;
  rawNoKas?: string;
  rawDate?: string;
  rawCashType?: string;
  rawProject: string;
  rawSubUnit?: string;
  rawCategory: string;
  rawSubCategory?: string;
  rawPic: string;
  rawDescription: string;
  rawRequestedAmount?: number;
  rawApprovedAmount: number;
  rawNotes?: string;

  // Resolved Mappings
  isValid: boolean;
  resolvedNoKas?: string;
  resolvedCashType: CashType;
  resolvedProjectId?: string;
  resolvedProjectName?: string;
  resolvedSubUnitId?: string;
  resolvedSubUnitName?: string;
  resolvedCategoryId?: string;
  resolvedCategoryName?: string;
  resolvedSubCategoryId?: string;
  resolvedSubCategoryName?: string;
  resolvedPicId?: string;
  resolvedPicName?: string;
  issues: string[];
}

export interface ImportPreviewResult {
  fileName?: string;
  sheetName: string;
  detectedFormat?: "REAL_WORKBOOK" | "STANDARD_TEMPLATE";
  recapSheetsCount?: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  uniqueNoKasCount: number;
  sharedNoKasItemCount: number;
  duplicateCount: number;
  totalApprovedAmount: number;
  unmappedProjects: string[];
  unmappedSubUnits: string[];
  unmappedCategories: string[];
  unmappedPics: string[];
  issues: ImportIssue[];
  rows: ParsedImportRow[];
}

export interface ExecuteImportPayload {
  batchCode: string;
  accDate: string; // ISO string or YYYY-MM-DD
  approvedByName?: string | null;
  notes?: string | null;
  items: Array<{
    noKas?: string;
    cashType: CashType;
    projectId: string;
    subUnitId?: string | null;
    categoryId: string;
    subCategoryId?: string | null;
    picId: string;
    description: string;
    requestedAmount?: number | null;
    approvedAmount: number;
    notes?: string | null;
  }>;
}

// Header Normalizer Helper
function normalizeHeader(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Clean string
function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && "text" in (val as Record<string, unknown>)) {
    return String((val as { text: unknown }).text).trim();
  }
  return String(val).trim();
}

// Clean number
function cleanNum(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  if (typeof val === "number") return isNaN(val) ? undefined : val;
  if (typeof val === "string") {
    const sanitized = val
      .replace(/Rp\.?/gi, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");
    const num = parseFloat(sanitized);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

// Clean date to YYYY-MM-DD
function cleanDate(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parts = trimmed.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
  }
  return undefined;
}

function inferProjectFromDescription(
  desc: string,
  projects: Array<{ id: string; code: string; name: string }>
): { id: string; code: string } {
  const upper = desc.toUpperCase();
  for (const p of projects) {
    if (p.code !== "INTERNAL" && (upper.includes(p.code) || upper.includes(p.name.toUpperCase()))) {
      return { id: p.id, code: p.code };
    }
  }
  const internal = projects.find((p) => p.code === "INTERNAL") || projects[0];
  return { id: internal.id, code: internal.code };
}

function inferCategoryFromDescription(
  desc: string,
  noKas: string | undefined,
  categories: Array<{ id: string; code: string; name: string }>
): { id: string; code: string } {
  const upper = desc.toUpperCase();
  const isKU = noKas && noKas.toUpperCase().startsWith("KU");
  if (upper.includes("UPAH") || upper.includes("TUKANG") || upper.includes("MANDOR") || upper.includes("LEMBUR")) {
    const c = categories.find((cat) => cat.code === "UPAH");
    if (c) return { id: c.id, code: c.code };
  }
  if (upper.includes("MATERIAL") || upper.includes("MATRIAL") || upper.includes("SEMEN") || upper.includes("BESI") || upper.includes("CAT") || upper.includes("PIPA")) {
    const c = categories.find((cat) => cat.code === "MATERIAL");
    if (c) return { id: c.id, code: c.code };
  }
  if (upper.includes("KONTRABON") || upper.includes("RESTULOGAM") || upper.includes("TOKO")) {
    const c = categories.find((cat) => cat.code === "KONTRABON");
    if (c) return { id: c.id, code: c.code };
  }
  if (upper.includes("SUBKON") || upper.includes("ALUMUNIUM") || upper.includes("GYPSUM") || upper.includes("RAILING")) {
    const c = categories.find((cat) => cat.code === "SUBKON");
    if (c) return { id: c.id, code: c.code };
  }
  if (upper.includes("SEWA") || upper.includes("SCAFOLDING")) {
    const c = categories.find((cat) => cat.code === "SEWA_ALAT");
    if (c) return { id: c.id, code: c.code };
  }
  if (upper.includes("KASBON") || upper.includes("CASH BON")) {
    const c = categories.find((cat) => cat.code === "KASBON");
    if (c) return { id: c.id, code: c.code };
  }
  if (upper.includes("BPJS") || upper.includes("LISTRIK") || upper.includes("INTERNET") || upper.includes("TLP") || upper.includes("ATK") || upper.includes("MATERAI")) {
    const c = categories.find((cat) => cat.code === "OPS_KANTOR");
    if (c) return { id: c.id, code: c.code };
  }

  const fallbackCode = isKU ? "OPS_KANTOR" : "OPS_LAPANGAN";
  const fallback = categories.find((cat) => cat.code === fallbackCode) || categories[0];
  return { id: fallback.id, code: fallback.code };
}

function inferPicFromDescription(
  desc: string,
  pics: Array<{ id: string; name: string }>
): { id: string; name: string } {
  const upper = desc.toUpperCase();
  for (const pic of pics) {
    if (upper.includes(pic.name.toUpperCase())) {
      return { id: pic.id, name: pic.name };
    }
  }
  const defaultPic = pics.find((p) => p.name.toUpperCase() === "NISA") || pics[0];
  return { id: defaultPic.id, name: defaultPic.name };
}

export async function parseAndValidateExcel(
  buffer: Buffer,
  fileName?: string
): Promise<ImportPreviewResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error("File Excel kosong atau tidak memiliki worksheet.");
  }

  // 1. Detect if this is the Real Multi-Sheet Company Workbook
  let isRealCompanyWorkbook = false;
  for (const ws of workbook.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const row = ws.getRow(r);
      let rowJoined = "";
      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
        const val = row.getCell(c).value;
        if (val !== null && val !== undefined) {
          rowJoined += " " + String(val);
        }
      }
      const upper = rowJoined.toUpperCase();
      if (upper.includes("REKAPAN PENGAJUAN") || upper.includes("POSISI KAS")) {
        isRealCompanyWorkbook = true;
        break;
      }
    }
    if (isRealCompanyWorkbook) break;
  }

  // BRANCH A: Real Company Multi-Sheet Workbook
  if (isRealCompanyWorkbook) {
    const realResult = await parseAndMapRealWorkbook(buffer);

    const allNoKas = realResult.uniqueVouchers.map((v) => v.noKas.toUpperCase());
    const existingBatches = await prisma.submissionBatch.findMany({
      where: { noKas: { in: allNoKas } },
      select: { noKas: true },
    });
    const existingDbNoKasSet = new Set<string>();
    for (const b of existingBatches) {
      if (b.noKas) existingDbNoKasSet.add(b.noKas.toUpperCase());
    }

    const parsedRows: ParsedImportRow[] = [];
    const issues: ImportIssue[] = [];
    let duplicateDbCount = 0;
    let sharedNoKasItemCount = 0;
    let totalApprovedAmount = 0;
    let validRowsCount = 0;
    let rowSeq = 1;

    for (const voucher of realResult.uniqueVouchers) {
      const upperNoKas = voucher.noKas.toUpperCase();
      const isDuplicateInDb = existingDbNoKasSet.has(upperNoKas);
      if (isDuplicateInDb) {
        duplicateDbCount++;
      }
      if (voucher.items.length > 1) {
        sharedNoKasItemCount += voucher.items.length - 1;
      }

      for (const item of voucher.items) {
        const rowNumber = rowSeq++;
        const rowIssues: string[] = [];

        if (isDuplicateInDb) {
          const problem = `No Kas '${upperNoKas}' sudah ada di database (batch sudah terdaftar sebelumnya).`;
          rowIssues.push(problem);
          issues.push({
            row: rowNumber,
            field: "No Kas",
            value: upperNoKas,
            problem,
          });
        }

        if (!item.approvedAmount || item.approvedAmount <= 0) {
          const problem = "Nominal ACC harus angka positif lebih besar dari 0.";
          rowIssues.push(problem);
          issues.push({
            row: rowNumber,
            field: "Nominal ACC",
            value: String(item.approvedAmount),
            problem,
          });
        }

        const isValid = rowIssues.length === 0;
        if (isValid) {
          validRowsCount++;
          totalApprovedAmount += item.approvedAmount;
        }

        parsedRows.push({
          rowNumber,
          rawNoKas: voucher.noKas,
          rawDate: voucher.primaryDate.toISOString().split("T")[0],
          rawCashType: voucher.cashType,
          rawProject: item.projectCode,
          rawSubUnit: item.subUnitId ? "SUB" : undefined,
          rawCategory: item.categoryCode,
          rawPic: item.picName,
          rawDescription: item.description,
          rawRequestedAmount: item.requestedAmount,
          rawApprovedAmount: item.approvedAmount,
          rawNotes: item.notes,
          isValid,
          resolvedNoKas: voucher.noKas,
          resolvedCashType: voucher.cashType,
          resolvedProjectId: item.projectId,
          resolvedProjectName: item.projectCode,
          resolvedSubUnitId: item.subUnitId,
          resolvedCategoryId: item.categoryId,
          resolvedCategoryName: item.categoryCode,
          resolvedPicId: item.picId,
          resolvedPicName: item.picName,
          issues: rowIssues,
        });
      }
    }

    return {
      fileName,
      sheetName: `Workbook Rekap Pengajuan 2026 (${realResult.recapSheetsCount} Sheet Rekap)`,
      detectedFormat: "REAL_WORKBOOK",
      recapSheetsCount: realResult.recapSheetsCount,
      totalRows: parsedRows.length,
      validRows: validRowsCount,
      invalidRows: parsedRows.length - validRowsCount,
      uniqueNoKasCount: realResult.uniqueVouchers.length,
      sharedNoKasItemCount,
      duplicateCount: duplicateDbCount,
      totalApprovedAmount,
      unmappedProjects: [],
      unmappedSubUnits: [],
      unmappedCategories: [],
      unmappedPics: [],
      issues,
      rows: parsedRows,
    };
  }

  // BRANCH B: Single Sheet / Standard Template
  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error("File Excel kosong atau tidak memiliki baris data.");
  }

  // Load Active Master Data from Database
  const [projects, categories, pics] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      include: { subUnits: { where: { isActive: true } } },
    }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: { subCategories: { where: { isActive: true } } },
    }),
    prisma.fieldPic.findMany({
      where: { isActive: true },
    }),
  ]);

  const projectMap = new Map<string, (typeof projects)[0]>();
  for (const p of projects) {
    projectMap.set(p.code.toLowerCase().trim(), p);
    projectMap.set(p.name.toLowerCase().trim(), p);
  }

  const categoryMap = new Map<string, (typeof categories)[0]>();
  for (const c of categories) {
    categoryMap.set(c.code.toLowerCase().trim(), c);
    categoryMap.set(c.name.toLowerCase().trim(), c);
  }

  const picMap = new Map<string, (typeof pics)[0]>();
  for (const pic of pics) {
    picMap.set(pic.name.toLowerCase().trim(), pic);
  }

  // Scan rows 1-15 for the best header row
  let headerRowNumber = 1;
  let colMap: Record<string, number> = {};
  let maxMatchedHeaders = 0;

  for (let r = 1; r <= Math.min(worksheet.rowCount, 15); r++) {
    const row = worksheet.getRow(r);
    const currentMap: Record<string, number> = {};
    let matchedCount = 0;

    row.eachCell((cell, colNumber) => {
      const header = normalizeHeader(cell.text || cell.value?.toString() || "");
      if (!header) return;

      if (["nokas", "no_kas", "nomorkas", "noacc", "no"].includes(header)) {
        currentMap.noKas = colNumber;
        matchedCount++;
      } else if (["jeniskas", "tipekas", "cashtype", "jenis"].includes(header)) {
        currentMap.cashType = colNumber;
        matchedCount++;
      } else if (["tanggal", "tgl", "date", "tglacc", "tanggalacc"].includes(header)) {
        currentMap.date = colNumber;
        matchedCount++;
      } else if (["proyek", "project", "namaproyek", "kodeproyek"].includes(header)) {
        currentMap.project = colNumber;
        matchedCount++;
      } else if (["subunit", "subproyek", "subproject", "unit"].includes(header)) {
        currentMap.subUnit = colNumber;
        matchedCount++;
      } else if (["kategori", "category", "kategoribiaya", "kategoripengeluaran"].includes(header)) {
        currentMap.category = colNumber;
        matchedCount++;
      } else if (["subkategori", "subcategory"].includes(header)) {
        currentMap.subCategory = colNumber;
        matchedCount++;
      } else if (["pic", "namapic", "penanggungjawab", "mandor", "fieldpic"].includes(header)) {
        currentMap.pic = colNumber;
        matchedCount++;
      } else if (
        [
          "uraian",
          "keterangan",
          "keteranganpengajuan",
          "deskripsi",
          "description",
          "peruntukan",
        ].includes(header)
      ) {
        currentMap.description = colNumber;
        matchedCount++;
      } else if (
        [
          "diajukan",
          "nominaldiajukan",
          "pengajuan",
          "requestedamount",
          "budget",
        ].includes(header)
      ) {
        currentMap.requestedAmount = colNumber;
        matchedCount++;
      } else if (
        [
          "acc",
          "nominalacc",
          "disetujui",
          "nominaldisetujui",
          "approvedamount",
          "jumlahacc",
          "sudah",
          "pencairan",
        ].includes(header)
      ) {
        currentMap.approvedAmount = colNumber;
        matchedCount++;
      } else if (["catatan", "notes", "keterangantambahan"].includes(header)) {
        currentMap.notes = colNumber;
        matchedCount++;
      }
    });

    if (matchedCount > maxMatchedHeaders) {
      maxMatchedHeaders = matchedCount;
      colMap = currentMap;
      headerRowNumber = r;
    }
  }

  // Fallback for amount: if no approved amount column, but pengajuan exists, use pengajuan
  if (!colMap.approvedAmount && colMap.requestedAmount) {
    colMap.approvedAmount = colMap.requestedAmount;
  }

  // Mandatory validations: Only Description & Amount are strictly required from header
  if (!colMap.description) {
    throw new Error(
      "Kolom keterangan/uraian ('KETERANGAN PENGAJUAN' atau 'Uraian') tidak ditemukan pada baris header."
    );
  }
  if (!colMap.approvedAmount) {
    throw new Error(
      "Kolom nominal ('PENGAJUAN' atau 'Nominal ACC') tidak ditemukan pada baris header."
    );
  }

  // Extract Raw Rows
  const rawRows: ParsedImportRow[] = [];
  const noKasCountMap = new Map<string, number>();
  const collectedNoKas: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    let hasData = false;
    row.eachCell(() => {
      hasData = true;
    });
    if (!hasData) return;

    const rawNoKas = colMap.noKas ? cleanStr(row.getCell(colMap.noKas).value) : undefined;
    const rawCashType = colMap.cashType ? cleanStr(row.getCell(colMap.cashType).value) : undefined;
    const rawDate = colMap.date ? cleanDate(row.getCell(colMap.date).value) : undefined;
    const rawDescription = cleanStr(row.getCell(colMap.description).value);
    const rawRequestedAmount = colMap.requestedAmount
      ? cleanNum(row.getCell(colMap.requestedAmount).value)
      : undefined;
    const rawApprovedAmount = cleanNum(row.getCell(colMap.approvedAmount).value) ?? 0;
    const rawNotes = colMap.notes ? cleanStr(row.getCell(colMap.notes).value) : undefined;

    // Resolve or Infer Project
    let rawProject = colMap.project ? cleanStr(row.getCell(colMap.project).value) : "";
    if (!rawProject) {
      const inferred = inferProjectFromDescription(rawDescription, projects);
      rawProject = inferred.code;
    }

    const rawSubUnit = colMap.subUnit ? cleanStr(row.getCell(colMap.subUnit).value) : undefined;

    // Resolve or Infer Category
    let rawCategory = colMap.category ? cleanStr(row.getCell(colMap.category).value) : "";
    if (!rawCategory) {
      const inferred = inferCategoryFromDescription(rawDescription, rawNoKas, categories);
      rawCategory = inferred.code;
    }

    const rawSubCategory = colMap.subCategory
      ? cleanStr(row.getCell(colMap.subCategory).value)
      : undefined;

    // Resolve or Infer PIC
    let rawPic = colMap.pic ? cleanStr(row.getCell(colMap.pic).value) : "";
    if (!rawPic) {
      const inferred = inferPicFromDescription(rawDescription, pics);
      rawPic = inferred.name;
    }

    if (rawNoKas) {
      const upperNoKas = rawNoKas.toUpperCase();
      noKasCountMap.set(upperNoKas, (noKasCountMap.get(upperNoKas) || 0) + 1);
      collectedNoKas.push(upperNoKas);
    }

    rawRows.push({
      rowNumber,
      rawNoKas,
      rawCashType,
      rawDate,
      rawProject,
      rawSubUnit,
      rawCategory,
      rawSubCategory,
      rawPic,
      rawDescription,
      rawRequestedAmount,
      rawApprovedAmount,
      rawNotes,
      isValid: true,
      resolvedCashType: CashType.KT,
      issues: [],
    });
  });

  // Batch Check Existing No Kas in DB
  const existingDbNoKasSet = new Set<string>();
  if (collectedNoKas.length > 0) {
    const existingBatches = await prisma.submissionBatch.findMany({
      where: { noKas: { in: Array.from(new Set(collectedNoKas)) } },
      select: { noKas: true },
    });
    for (const b of existingBatches) {
      if (b.noKas) existingDbNoKasSet.add(b.noKas.toUpperCase());
    }
  }

  // Row-by-Row Deep Validation
  const allIssues: ImportIssue[] = [];
  const unmappedProjectsSet = new Set<string>();
  const unmappedSubUnitsSet = new Set<string>();
  const unmappedCategoriesSet = new Set<string>();
  const unmappedPicsSet = new Set<string>();
  let duplicateDbCount = 0;
  let sharedNoKasItemCount = 0;
  let totalApprovedAmount = 0;

  for (const item of rawRows) {
    const rowIssues: string[] = [];

    // A. Validate No Kas (if provided)
    if (item.rawNoKas) {
      const upper = item.rawNoKas.toUpperCase();
      if (!isValidNoKasFormat(upper)) {
        const problem = `Format No Kas tidak valid: '${item.rawNoKas}'. Format harus KU.YY.xxx atau KT.YY.xxx.`;
        rowIssues.push(problem);
        allIssues.push({
          row: item.rowNumber,
          field: "No Kas",
          value: item.rawNoKas,
          problem,
        });
      } else if (existingDbNoKasSet.has(upper)) {
        const problem = `No Kas '${upper}' sudah ada di database (batch sudah terdaftar sebelumnya).`;
        rowIssues.push(problem);
        allIssues.push({
          row: item.rowNumber,
          field: "No Kas",
          value: upper,
          problem,
        });
        duplicateDbCount++;
      } else {
        item.resolvedNoKas = upper;
        if ((noKasCountMap.get(upper) || 0) > 1) {
          sharedNoKasItemCount++;
        }
      }
    }

    // B. Resolve Cash Type
    if (item.rawCashType) {
      const ct = item.rawCashType.toUpperCase().trim();
      if (ct === "KU" || ct === "KT") {
        item.resolvedCashType = ct as CashType;
      } else {
        const problem = `Jenis Kas '${item.rawCashType}' tidak valid. Harus KU atau KT.`;
        rowIssues.push(problem);
        allIssues.push({
          row: item.rowNumber,
          field: "Jenis Kas",
          value: item.rawCashType,
          problem,
        });
      }
    } else if (item.resolvedNoKas) {
      item.resolvedCashType = item.resolvedNoKas.startsWith("KU.") ? CashType.KU : CashType.KT;
    } else {
      item.resolvedCashType = CashType.KT;
    }

    // Consistency check: No Kas prefix vs cashType
    if (item.resolvedNoKas && !item.resolvedNoKas.startsWith(item.resolvedCashType + ".")) {
      const problem = `Prefix No Kas '${item.resolvedNoKas}' tidak sesuai dengan jenis kas '${item.resolvedCashType}'.`;
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "No Kas vs Jenis Kas",
        value: `${item.resolvedNoKas} != ${item.resolvedCashType}`,
        problem,
      });
    }

    // C. Validate Project
    const proj = projectMap.get(item.rawProject.toLowerCase().trim());
    if (!proj) {
      const problem = `Proyek '${item.rawProject}' tidak ditemukan di master proyek.`;
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "Proyek",
        value: item.rawProject,
        problem,
      });
      unmappedProjectsSet.add(item.rawProject);
    } else {
      item.resolvedProjectId = proj.id;
      item.resolvedProjectName = proj.name;

      if (item.rawSubUnit) {
        const matchedSub = proj.subUnits.find(
          (s) =>
            s.code.toLowerCase() === item.rawSubUnit?.toLowerCase().trim() ||
            s.name.toLowerCase() === item.rawSubUnit?.toLowerCase().trim()
        );
        if (!matchedSub) {
          const problem = `Sub-Unit '${item.rawSubUnit}' tidak terdaftar pada Proyek '${proj.name}'.`;
          rowIssues.push(problem);
          allIssues.push({
            row: item.rowNumber,
            field: "Sub Unit",
            value: item.rawSubUnit,
            problem,
          });
          unmappedSubUnitsSet.add(`${item.rawProject} -> ${item.rawSubUnit}`);
        } else {
          item.resolvedSubUnitId = matchedSub.id;
          item.resolvedSubUnitName = matchedSub.name;
        }
      }
    }

    // D. Validate Category
    const cat = categoryMap.get(item.rawCategory.toLowerCase().trim());
    if (!cat) {
      const problem = `Kategori '${item.rawCategory}' tidak ditemukan di master kategori.`;
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "Kategori",
        value: item.rawCategory,
        problem,
      });
      unmappedCategoriesSet.add(item.rawCategory);
    } else {
      item.resolvedCategoryId = cat.id;
      item.resolvedCategoryName = cat.name;

      if (item.rawSubCategory) {
        const matchedSubCat = cat.subCategories.find(
          (s) =>
            s.code.toLowerCase() === item.rawSubCategory?.toLowerCase().trim() ||
            s.name.toLowerCase() === item.rawSubCategory?.toLowerCase().trim()
        );
        if (matchedSubCat) {
          item.resolvedSubCategoryId = matchedSubCat.id;
          item.resolvedSubCategoryName = matchedSubCat.name;
        }
      }
    }

    // E. Validate PIC
    const pic = picMap.get(item.rawPic.toLowerCase().trim());
    if (!pic) {
      const problem = `PIC '${item.rawPic}' tidak ditemukan di master PIC.`;
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "PIC",
        value: item.rawPic,
        problem,
      });
      unmappedPicsSet.add(item.rawPic);
    } else {
      item.resolvedPicId = pic.id;
      item.resolvedPicName = pic.name;
    }

    // F. Validate Description
    if (!item.rawDescription || item.rawDescription.length < 3) {
      const problem = "Uraian kebutuhan minimal 3 karakter.";
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "Uraian",
        value: item.rawDescription || "(kosong)",
        problem,
      });
    }

    // G. Validate Amounts
    if (!item.rawApprovedAmount || item.rawApprovedAmount <= 0) {
      const problem = "Nominal ACC harus angka positif lebih besar dari 0.";
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "Nominal ACC",
        value: String(item.rawApprovedAmount),
        problem,
      });
    } else {
      totalApprovedAmount += item.rawApprovedAmount;
    }

    if (item.rawRequestedAmount !== undefined && item.rawRequestedAmount <= 0) {
      const problem = "Nominal Diajukan harus angka positif jika diisi.";
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "Nominal Diajukan",
        value: String(item.rawRequestedAmount),
        problem,
      });
    }

    item.issues = rowIssues;
    item.isValid = rowIssues.length === 0;
  }

  const validRows = rawRows.filter((r) => r.isValid).length;
  const invalidRows = rawRows.length - validRows;

  return {
    fileName,
    sheetName: worksheet.name,
    detectedFormat: "STANDARD_TEMPLATE",
    totalRows: rawRows.length,
    validRows,
    invalidRows,
    uniqueNoKasCount: noKasCountMap.size,
    sharedNoKasItemCount,
    duplicateCount: duplicateDbCount,
    totalApprovedAmount,
    unmappedProjects: Array.from(unmappedProjectsSet),
    unmappedSubUnits: Array.from(unmappedSubUnitsSet),
    unmappedCategories: Array.from(unmappedCategoriesSet),
    unmappedPics: Array.from(unmappedPicsSet),
    issues: allIssues,
    rows: rawRows,
  };
}

export async function executeControlledImport(payload: ExecuteImportPayload) {
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Tidak ada item data valid untuk diimpor.");
  }

  return await prisma.$transaction(
    async (tx) => {
      // Group items by No Kas so that 1 No Kas = 1 SubmissionBatch with N items!
      const groupedByNoKas = new Map<string, typeof payload.items>();
      for (const item of payload.items) {
        const key = item.noKas ? item.noKas.toUpperCase() : "AUTO_GEN";
        if (!groupedByNoKas.has(key)) {
          groupedByNoKas.set(key, []);
        }
        groupedByNoKas.get(key)!.push(item);
      }

      let totalImported = 0;
      let totalAmount = 0;
      let primaryBatchId = "";
      let primaryBatchCode = "";

      let batchSeq = 1;
      for (const [noKasKey, itemsInBatch] of groupedByNoKas.entries()) {
        const batchCode =
          groupedByNoKas.size === 1
            ? payload.batchCode
            : `${payload.batchCode}-${noKasKey !== "AUTO_GEN" ? noKasKey : batchSeq++}`;

        const result = await createSubmissionBatch(
          {
            batchCode,
            accDate: new Date(payload.accDate),
            approvedByName: payload.approvedByName ?? "Pa Giri",
            notes: payload.notes ?? "Impor Data Excel Terkontrol",
            items: itemsInBatch.map((i) => ({
              noKas: i.noKas,
              cashType: i.cashType,
              projectId: i.projectId,
              subUnitId: i.subUnitId || null,
              categoryId: i.categoryId,
              subCategoryId: i.subCategoryId || null,
              picId: i.picId,
              description: i.description,
              requestedAmount: i.requestedAmount ? Number(i.requestedAmount) : null,
              approvedAmount: Number(i.approvedAmount),
              notes: i.notes || null,
            })),
          },
          tx
        );

        if (!primaryBatchId) {
          primaryBatchId = result.batch.id;
          primaryBatchCode = result.batch.batchCode;
        }

        totalImported += result.items.length;
        totalAmount += result.items.reduce(
          (sum, item) => sum + Number(item.approvedAmount),
          0
        );
      }

      return {
        batchId: primaryBatchId,
        batchCode: primaryBatchCode,
        importedCount: totalImported,
        totalApprovedAmount: totalAmount,
      };
    },
    { maxWait: 10000, timeout: 35000 }
  );
}

export async function generateAccImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ProTrack System";
  workbook.lastModifiedBy = "ProTrack System";
  workbook.created = new Date();

  // 1. Data Entry Sheet
  const sheet = workbook.addWorksheet("Data Pengajuan ACC", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "No Kas", key: "noKas", width: 16 },
    { header: "Jenis Kas", key: "cashType", width: 12 },
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Proyek", key: "project", width: 22 },
    { header: "Sub Unit", key: "subUnit", width: 20 },
    { header: "Kategori", key: "category", width: 22 },
    { header: "Sub Kategori", key: "subCategory", width: 22 },
    { header: "PIC", key: "pic", width: 18 },
    { header: "Uraian", key: "description", width: 38 },
    { header: "Nominal Diajukan", key: "requestedAmount", width: 18 },
    { header: "Nominal ACC", key: "approvedAmount", width: 18 },
    { header: "Catatan", key: "notes", width: 25 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate 800
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Sample example rows
  sheet.addRow({
    noKas: "KT.26.901",
    cashType: "KT",
    date: "2026-10-01",
    project: "ALCENT",
    subUnit: "SMP",
    category: "UPAH",
    subCategory: "Upah Tukang Harian",
    pic: "PA HERI",
    description: "Upah tukang plesteran lantai 2 minggu ke-1",
    requestedAmount: 3500000,
    approvedAmount: 3500000,
    notes: "ACC sesuai SPK",
  });

  sheet.addRow({
    noKas: "KT.26.902",
    cashType: "KT",
    date: "2026-10-01",
    project: "SUMEDANG",
    subUnit: "SIPIL",
    category: "MATERIAL",
    subCategory: "Material Pokok (Semen, Besi, Pasir)",
    pic: "PA DEDI",
    description: "Pembelian semen 50 sak untuk pondasi",
    requestedAmount: 4000000,
    approvedAmount: 3750000,
    notes: "Disetujui 3.75jt",
  });

  // Reference / Guidance Sheet
  const refSheet = workbook.addWorksheet("Panduan & Master Data");
  refSheet.columns = [
    { header: "Bagian", key: "section", width: 20 },
    { header: "Kode / Nilai Valid", key: "code", width: 25 },
    { header: "Keterangan", key: "desc", width: 45 },
  ];

  const refHeader = refSheet.getRow(1);
  refHeader.height = 24;
  refHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };
    cell.alignment = { vertical: "middle" };
  });

  // Add guidance notes
  refSheet.addRow({
    section: "ATURAN NO KAS",
    code: "KT.YY.xxx atau KU.YY.xxx",
    desc: "Boleh dikosongkan (sistem generate otomatis) atau diisi manual unik.",
  });
  refSheet.addRow({
    section: "JENIS KAS",
    code: "KT / KU",
    desc: "KT = Kas Terikat Proyek, KU = Kas Umum Operasional Kantor.",
  });
  refSheet.addRow({
    section: "PROYEK VALID",
    code: "ALCENT, SUMEDANG, KAWALUYAAN, TANGGERANG, RT_BU_ANI, INTERNAL",
    desc: "Gunakan kode proyek atau nama proyek persis.",
  });
  refSheet.addRow({
    section: "KATEGORI VALID",
    code: "UPAH, MATERIAL, KONTRABON, SUBKON, SEWA_ALAT, OPS_LAPANGAN, OPS_KANTOR, KASBON, TALANGAN",
    desc: "Gunakan kode kategori atau nama kategori.",
  });
  refSheet.addRow({
    section: "PIC VALID",
    code: "PA HERI, PA DEDI, PA MAMAT, NISA, PA UDEN, PA ENGKUS, PA AGUS",
    desc: "Nama PIC harus terdaftar di master data.",
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
