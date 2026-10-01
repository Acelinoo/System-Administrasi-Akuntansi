import ExcelJS from "exceljs";
import { prisma } from "../db/prisma";
import { CashType, Prisma } from "@prisma/client";
import { createSubmissionBatch } from "./acc.service";
import { isValidNoKasFormat } from "./no-kas";

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

export async function parseAndValidateExcel(
  buffer: Buffer,
  fileName?: string
): Promise<ImportPreviewResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error("File Excel kosong atau tidak memiliki baris data.");
  }

  // 1. Identify Columns from Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  const colMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const header = normalizeHeader(cell.text || "");
    if (!header) return;

    if (["nokas", "no_kas", "nomorkas", "noacc", "no"].includes(header)) {
      colMap.noKas = colNumber;
    } else if (["jeniskas", "tipekas", "cashtype", "jenis"].includes(header)) {
      colMap.cashType = colNumber;
    } else if (["tanggal", "tgl", "date", "tglacc", "tanggalacc"].includes(header)) {
      colMap.date = colNumber;
    } else if (["proyek", "project", "namaproyek", "kodeproyek"].includes(header)) {
      colMap.project = colNumber;
    } else if (["subunit", "subproyek", "subproject", "unit"].includes(header)) {
      colMap.subUnit = colNumber;
    } else if (["kategori", "category", "kategoribiaya", "kategoripengeluaran"].includes(header)) {
      colMap.category = colNumber;
    } else if (["subkategori", "subcategory"].includes(header)) {
      colMap.subCategory = colNumber;
    } else if (["pic", "namapic", "penanggungjawab", "mandor", "fieldpic"].includes(header)) {
      colMap.pic = colNumber;
    } else if (["uraian", "keterangan", "deskripsi", "description", "peruntukan"].includes(header)) {
      colMap.description = colNumber;
    } else if (["diajukan", "nominaldiajukan", "pengajuan", "requestedamount", "budget"].includes(header)) {
      colMap.requestedAmount = colNumber;
    } else if (["acc", "nominalacc", "disetujui", "nominaldisetujui", "approvedamount", "jumlahacc"].includes(header)) {
      colMap.approvedAmount = colNumber;
    } else if (["catatan", "notes", "keterangantambahan"].includes(header)) {
      colMap.notes = colNumber;
    }
  });

  // Verify Mandatory Columns
  if (!colMap.project) {
    throw new Error("Kolom 'Proyek' (atau 'Project') tidak ditemukan pada baris header.");
  }
  if (!colMap.category) {
    throw new Error("Kolom 'Kategori' (atau 'Category') tidak ditemukan pada baris header.");
  }
  if (!colMap.pic) {
    throw new Error("Kolom 'PIC' (atau 'Nama PIC') tidak ditemukan pada baris header.");
  }
  if (!colMap.description) {
    throw new Error("Kolom 'Uraian' (atau 'Keterangan') tidak ditemukan pada baris header.");
  }
  if (!colMap.approvedAmount) {
    throw new Error("Kolom 'Nominal ACC' (atau 'Disetujui' / 'ACC') tidak ditemukan pada baris header.");
  }

  // 2. Fetch Master Data from Database for Mapping
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

  const projectMap = new Map<string, typeof projects[0]>();
  for (const p of projects) {
    projectMap.set(p.code.toLowerCase().trim(), p);
    projectMap.set(p.name.toLowerCase().trim(), p);
  }

  const categoryMap = new Map<string, typeof categories[0]>();
  for (const c of categories) {
    categoryMap.set(c.code.toLowerCase().trim(), c);
    categoryMap.set(c.name.toLowerCase().trim(), c);
  }

  const picMap = new Map<string, typeof pics[0]>();
  for (const pic of pics) {
    picMap.set(pic.name.toLowerCase().trim(), pic);
  }

  // 3. Extract Raw Rows & Track Shared No Kas
  const rawRows: ParsedImportRow[] = [];
  const noKasCountMap = new Map<string, number>();
  const collectedNoKas: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    let hasData = false;
    row.eachCell(() => {
      hasData = true;
    });
    if (!hasData) return;

    const rawNoKas = colMap.noKas ? cleanStr(row.getCell(colMap.noKas).value) : undefined;
    const rawCashType = colMap.cashType ? cleanStr(row.getCell(colMap.cashType).value) : undefined;
    const rawDate = colMap.date ? cleanDate(row.getCell(colMap.date).value) : undefined;
    const rawProject = cleanStr(row.getCell(colMap.project).value);
    const rawSubUnit = colMap.subUnit ? cleanStr(row.getCell(colMap.subUnit).value) : undefined;
    const rawCategory = cleanStr(row.getCell(colMap.category).value);
    const rawSubCategory = colMap.subCategory ? cleanStr(row.getCell(colMap.subCategory).value) : undefined;
    const rawPic = cleanStr(row.getCell(colMap.pic).value);
    const rawDescription = cleanStr(row.getCell(colMap.description).value);
    const rawRequestedAmount = colMap.requestedAmount ? cleanNum(row.getCell(colMap.requestedAmount).value) : undefined;
    const rawApprovedAmount = cleanNum(row.getCell(colMap.approvedAmount).value) ?? 0;
    const rawNotes = colMap.notes ? cleanStr(row.getCell(colMap.notes).value) : undefined;

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

  // 4. Batch Check Existing No Kas in DB (across existing batches)
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

  // 5. Row-by-Row Deep Validation
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
    if (!item.rawProject) {
      const problem = "Kolom Proyek tidak boleh kosong.";
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "Proyek",
        value: "",
        problem,
      });
    } else {
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

        // D. Validate Sub-Unit (Parent-Child Integrity)
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
    }

    // E. Validate Category & Sub-Category
    if (!item.rawCategory) {
      const problem = "Kolom Kategori tidak boleh kosong.";
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "Kategori",
        value: "",
        problem,
      });
    } else {
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

        // Sub Category
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
    }

    // F. Validate PIC
    if (!item.rawPic) {
      const problem = "Kolom PIC tidak boleh kosong.";
      rowIssues.push(problem);
      allIssues.push({
        row: item.rowNumber,
        field: "PIC",
        value: "",
        problem,
      });
    } else {
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
    }

    // G. Validate Description
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

    // H. Validate Amounts
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
    uraian: "Upah tukang plesteran lantai 2 minggu ke-1",
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
    uraian: "Pembelian semen 50 sak untuk pondasi",
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
