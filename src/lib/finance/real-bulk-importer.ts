import ExcelJS from "exceljs";
import path from "path";
import { prisma } from "../db/prisma";
import { CashType, AccStatus } from "@prisma/client";

export interface SourceRow {
  sheetName: string;
  rowIdx: number;
  dateBlock?: string;
  parsedDate: Date;
  noKas: string;
  description: string;
  pengajuan: number;
  pencairan: number;
  paymentChannel?: "CASH" | "TRANSFER" | "GIRO";
  // Resolved Master
  projectId: string;
  projectCode: string;
  subUnitId?: string;
  subUnitCode?: string;
  categoryId: string;
  categoryCode: string;
  picId: string;
  picName: string;
  cashType: CashType;
}

export interface CanonicalVoucher {
  noKas: string;
  cashType: CashType;
  primaryDate: Date;
  approvedByName: string;
  sourceAppearances: Array<{ sheet: string; row: number; dateBlock?: string }>;
  items: Array<{
    itemNo: number;
    description: string;
    requestedAmount: number;
    approvedAmount: number;
    realizedAmount: number;
    projectId: string;
    projectCode: string;
    subUnitId?: string;
    categoryId: string;
    categoryCode: string;
    picId: string;
    picName: string;
    notes?: string;
  }>;
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
      if ("text" in obj) return String(obj.text || "").trim();
      if ("result" in obj) return String(obj.result || "").trim();
    }
    return String(val).trim();
  } catch {
    return "";
  }
}

function parseIndonesianDate(text: string, fallbackDate: Date = new Date("2026-01-09")): Date {
  try {
    const months: Record<string, number> = {
      JANUARI: 0, JAN: 0,
      FEBRUARI: 1, PEBRUARI: 1, FEB: 1,
      MARET: 2, MAR: 2,
      APRIL: 3, APR: 3,
      MEI: 4, MAY: 4,
      JUNI: 5, JUN: 5,
      JULI: 6, JUL: 6,
      AGUSTUS: 7, AGS: 7, AGU: 7,
      SEPTEMBER: 8, SEP: 8,
      OKTOBER: 9, OKT: 9,
      NOVEMBER: 10, NOV: 10,
      DESEMBER: 11, DES: 11,
    };

    const clean = text.toUpperCase().replace(/PER\s+TANGGAL/g, "").trim();
    const match = clean.match(/(\d{1,2})\s+([A-Z]+)\s+(\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const mStr = match[2];
      const year = parseInt(match[3], 10);
      const month = months[mStr] !== undefined ? months[mStr] : 0;
      return new Date(Date.UTC(year, month, day));
    }
  } catch {
    // fallback
  }
  return fallbackDate;
}

export async function parseAndMapRealWorkbook(filePath: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  // Load active master data from DB
  const projects = await prisma.project.findMany({
    include: { subUnits: true },
  });
  const categories = await prisma.expenseCategory.findMany({
    include: { subCategories: true },
  });
  const pics = await prisma.fieldPic.findMany();

  const projectMap = new Map(projects.map((p) => [p.code, p]));
  const categoryMap = new Map(categories.map((c) => [c.code, c]));
  const picMap = new Map(pics.map((p) => [p.name.toUpperCase(), p]));

  // Default fallback entities
  const internalProj = projectMap.get("INTERNAL") || projects[0];
  const opsKantorCat = categoryMap.get("OPS_KANTOR") || categories[0];
  const opsLapanganCat = categoryMap.get("OPS_LAPANGAN") || categories[0];
  const defaultPic = picMap.get("NISA") || pics[0];

  const candidateRows: SourceRow[] = [];
  const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;

  const recapSheets: string[] = [];

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
    recapSheets.push(sheetName);

    let currentDateBlock = "";
    const sheetDefaultDate = parseIndonesianDate(sheetName);

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const maxCol = Math.min(ws.columnCount, 30);

      // check if date block
      for (let c = 1; c <= maxCol; c++) {
        const val = getCellString(row.getCell(c));
        if (val.toUpperCase().startsWith("PER TANGGAL")) {
          currentDateBlock = val;
          break;
        }
      }

      // Check Col 2 (B) for primary No Kas
      const bVal = getCellString(row.getCell(2));
      if (noKasRegex.test(bVal)) {
        const noKas = bVal.toUpperCase();
        const desc = getCellString(row.getCell(3));
        const pengajuan = parseFloat(getCellString(row.getCell(4)).replace(/[^0-9.-]/g, "") || "0");
        
        // Pencairan
        const sudah = parseFloat(getCellString(row.getCell(5)).replace(/[^0-9.-]/g, "") || "0");
        const cash = parseFloat(getCellString(row.getCell(6)).replace(/[^0-9.-]/g, "") || "0");
        const giro = parseFloat(getCellString(row.getCell(7)).replace(/[^0-9.-]/g, "") || "0");
        const trf = parseFloat(getCellString(row.getCell(8)).replace(/[^0-9.-]/g, "") || "0");

        const pencairan = Math.max(0, (isNaN(sudah) ? 0 : sudah) + (isNaN(cash) ? 0 : cash) + (isNaN(giro) ? 0 : giro) + (isNaN(trf) ? 0 : trf));

        let paymentChannel: "CASH" | "TRANSFER" | "GIRO" = "CASH";
        if (!isNaN(trf) && trf > 0) paymentChannel = "TRANSFER";
        else if (!isNaN(giro) && giro > 0) paymentChannel = "GIRO";

        const upperDesc = desc.toUpperCase();

        // 1. Resolve Project
        let matchedProject = internalProj;
        let matchedSubUnitId: string | undefined = undefined;
        let matchedSubUnitCode: string | undefined = undefined;

        if (upperDesc.includes("SUMEDANG")) {
          matchedProject = projectMap.get("SUMEDANG") || internalProj;
          if (upperDesc.includes("SMA")) {
            const sub = matchedProject.subUnits.find((s) => s.code === "SMA");
            if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
          } else if (upperDesc.includes("SMP")) {
            const sub = matchedProject.subUnits.find((s) => s.code === "SMP");
            if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
          } else if (upperDesc.includes("SD")) {
            const sub = matchedProject.subUnits.find((s) => s.code === "SD");
            if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
          } else if (upperDesc.includes("TK")) {
            const sub = matchedProject.subUnits.find((s) => s.code === "TK");
            if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
          }
        } else if (upperDesc.includes("ALCENT") || upperDesc.includes("AL-CENT")) {
          matchedProject = projectMap.get("ALCENT") || internalProj;
          if (upperDesc.includes("SMA")) {
            const sub = matchedProject.subUnits.find((s) => s.code === "SMA");
            if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
          } else if (upperDesc.includes("SMP")) {
            const sub = matchedProject.subUnits.find((s) => s.code === "SMP");
            if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
          }
        } else if (upperDesc.includes("KAWALUYAAN")) {
          matchedProject = projectMap.get("KAWALUYAAN") || internalProj;
        } else if (upperDesc.includes("BU ANI") || upperDesc.includes("RT BU ANI")) {
          matchedProject = projectMap.get("RT_BU_ANI") || internalProj;
        } else if (upperDesc.includes("TANGGERANG") || upperDesc.includes("TANGERANG")) {
          matchedProject = projectMap.get("TANGGERANG") || internalProj;
        } else if (upperDesc.includes("DARUL ULUM")) {
          matchedProject = projectMap.get("DARUL_ULUM") || internalProj;
        } else if (upperDesc.includes("BUDI INDAH") || upperDesc.includes("BD INDAH")) {
          matchedProject = projectMap.get("BUDI_INDAH") || internalProj;
        } else if (upperDesc.includes("APARTEMEN")) {
          matchedProject = projectMap.get("APARTEMEN") || internalProj;
        } else if (upperDesc.includes("ANTAPANI")) {
          matchedProject = projectMap.get("ANTAPANI") || internalProj;
        } else if (upperDesc.includes("CIREBON")) {
          matchedProject = projectMap.get("CIREBON") || internalProj;
        } else if (upperDesc.includes("GITAR") || upperDesc.includes("JL GITAR")) {
          matchedProject = projectMap.get("JL_GITAR") || internalProj;
        } else if (upperDesc.includes("SMP")) {
          matchedProject = projectMap.get("ALCENT") || internalProj;
          const sub = matchedProject.subUnits.find((s) => s.code === "SMP");
          if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
        } else if (upperDesc.includes("SMA")) {
          matchedProject = projectMap.get("ALCENT") || internalProj;
          const sub = matchedProject.subUnits.find((s) => s.code === "SMA");
          if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
        } else if (upperDesc.includes("SD")) {
          matchedProject = projectMap.get("ALCENT") || internalProj;
          const sub = matchedProject.subUnits.find((s) => s.code === "SD_TK");
          if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
        } else if (upperDesc.includes("TK")) {
          matchedProject = projectMap.get("ALCENT") || internalProj;
          const sub = matchedProject.subUnits.find((s) => s.code === "SD_TK");
          if (sub) { matchedSubUnitId = sub.id; matchedSubUnitCode = sub.code; }
        }

        // 2. Resolve Category
        let matchedCategory = noKas.startsWith("KU") ? opsKantorCat : opsLapanganCat;
        if (upperDesc.includes("UPAH") || upperDesc.includes("TUKANG") || upperDesc.includes("MANDOR") || upperDesc.includes("LEMBUR")) {
          matchedCategory = categoryMap.get("UPAH") || matchedCategory;
        } else if (upperDesc.includes("MATERIAL") || upperDesc.includes("MATRIAL") || upperDesc.includes("SEMEN") || upperDesc.includes("BESI") || upperDesc.includes("CAT") || upperDesc.includes("PIPA")) {
          matchedCategory = categoryMap.get("MATERIAL") || matchedCategory;
        } else if (upperDesc.includes("KONTRABON") || upperDesc.includes("RESTULOGAM") || upperDesc.includes("TOKO")) {
          matchedCategory = categoryMap.get("KONTRABON") || matchedCategory;
        } else if (upperDesc.includes("SUBKON") || upperDesc.includes("ALUMUNIUM") || upperDesc.includes("GYPSUM") || upperDesc.includes("RAILING")) {
          matchedCategory = categoryMap.get("SUBKON") || matchedCategory;
        } else if (upperDesc.includes("SEWA") || upperDesc.includes("SCAFOLDING")) {
          matchedCategory = categoryMap.get("SEWA_ALAT") || matchedCategory;
        } else if (upperDesc.includes("BBM") || upperDesc.includes("TOL") || upperDesc.includes("PARKIR")) {
          matchedCategory = categoryMap.get("OPS_LAPANGAN") || matchedCategory;
        } else if (upperDesc.includes("KEAMANAN") || upperDesc.includes("SATPAM")) {
          matchedCategory = categoryMap.get("OPS_LAPANGAN") || matchedCategory;
        } else if (upperDesc.includes("KASBON") || upperDesc.includes("CASH BON")) {
          matchedCategory = categoryMap.get("KASBON") || matchedCategory;
        } else if (upperDesc.includes("BPJS") || upperDesc.includes("LISTRIK") || upperDesc.includes("INTERNET") || upperDesc.includes("TLP") || upperDesc.includes("ATK") || upperDesc.includes("MATERAI")) {
          matchedCategory = categoryMap.get("OPS_KANTOR") || matchedCategory;
        }

        // 3. Resolve PIC
        let matchedPic = defaultPic;
        if (upperDesc.includes("HERI")) matchedPic = picMap.get("PA HERI") || matchedPic;
        else if (upperDesc.includes("DEDI")) matchedPic = picMap.get("PA DEDI") || matchedPic;
        else if (upperDesc.includes("MAMAT")) matchedPic = picMap.get("PA MAMAT") || matchedPic;
        else if (upperDesc.includes("UDEN")) matchedPic = picMap.get("PA UDEN") || matchedPic;
        else if (upperDesc.includes("ENGKUS")) matchedPic = picMap.get("PA ENGKUS") || matchedPic;
        else if (upperDesc.includes("AGUS")) matchedPic = picMap.get("PA AGUS") || matchedPic;

        const rowDate = currentDateBlock ? parseIndonesianDate(currentDateBlock, sheetDefaultDate) : sheetDefaultDate;

        candidateRows.push({
          sheetName,
          rowIdx: r,
          dateBlock: currentDateBlock || undefined,
          parsedDate: rowDate,
          noKas,
          description: desc || "Pengajuan Tanpa Keterangan",
          pengajuan: isNaN(pengajuan) ? 0 : pengajuan,
          pencairan: isNaN(pencairan) ? 0 : pencairan,
          paymentChannel,
          projectId: matchedProject.id,
          projectCode: matchedProject.code,
          subUnitId: matchedSubUnitId,
          subUnitCode: matchedSubUnitCode,
          categoryId: matchedCategory.id,
          categoryCode: matchedCategory.code,
          picId: matchedPic.id,
          picName: matchedPic.name,
          cashType: noKas.startsWith("KU") ? CashType.KU : CashType.KT,
        });
      }
    }
  }

  // Group candidateRows into Canonical Vouchers
  const voucherMap = new Map<string, CanonicalVoucher>();

  for (const row of candidateRows) {
    if (!voucherMap.has(row.noKas)) {
      voucherMap.set(row.noKas, {
        noKas: row.noKas,
        cashType: row.cashType,
        primaryDate: row.parsedDate,
        approvedByName: "Pa Giri",
        sourceAppearances: [{ sheet: row.sheetName, row: row.rowIdx, dateBlock: row.dateBlock }],
        items: [],
      });
    }

    const voucher = voucherMap.get(row.noKas)!;
    if (!voucher.sourceAppearances.some((a) => a.sheet === row.sheetName && a.row === row.rowIdx)) {
      voucher.sourceAppearances.push({ sheet: row.sheetName, row: row.rowIdx, dateBlock: row.dateBlock });
    }

    // Check if identical item already recorded in this voucher (snapshot de-duplication)
    const existingItem = voucher.items.find(
      (it) => it.description === row.description && it.approvedAmount === row.pengajuan
    );

    if (existingItem) {
      // If sheet has updated realization, update it
      if (row.pencairan > existingItem.realizedAmount) {
        existingItem.realizedAmount = row.pencairan;
      }
    } else {
      voucher.items.push({
        itemNo: voucher.items.length + 1,
        description: row.description,
        requestedAmount: row.pengajuan,
        approvedAmount: row.pengajuan,
        realizedAmount: row.pencairan,
        projectId: row.projectId,
        projectCode: row.projectCode,
        subUnitId: row.subUnitId,
        categoryId: row.categoryId,
        categoryCode: row.categoryCode,
        picId: row.picId,
        picName: row.picName,
        notes: `Sumber Excel: ${row.sheetName} Baris ${row.rowIdx}`,
      });
    }
  }

  return {
    recapSheetsCount: recapSheets.length,
    recapSheets,
    totalRawRows: candidateRows.length,
    uniqueVouchers: Array.from(voucherMap.values()),
  };
}

export interface BulkImportResult {
  candidateBatchesCount: number;
  candidateItemsCount: number;
  importedBatchesCount: number;
  importedItemsCount: number;
  skippedExistingCount: number;
  failedCount: number;
  totalCandidateApprovedAmount: number;
  totalImportedApprovedAmount: number;
  totalCandidateRealizedAmount: number;
  totalImportedRealizedAmount: number;
  existingCollisions: string[];
  sampleBatchCodes: string[];
  projectBreakdown: Record<string, { count: number; approvedAmount: number }>;
  picBreakdown: Record<string, { count: number; approvedAmount: number }>;
  categoryBreakdown: Record<string, { count: number; approvedAmount: number }>;
}

export async function executeRealDataBulkImport(
  filePath: string,
  options: { runSampleOnly?: boolean } = {}
): Promise<BulkImportResult> {
  const parsed = await parseAndMapRealWorkbook(filePath);

  // Check existing DB records
  const existingBatches = await prisma.submissionBatch.findMany({
    select: { noKas: true, batchCode: true },
  });
  const existingItems = await prisma.accExpenseItem.findMany({
    select: { noKas: true },
  });

  const existingNoKasSet = new Set<string>();
  existingBatches.forEach((b) => { if (b.noKas) existingNoKasSet.add(b.noKas.toUpperCase()); });
  existingItems.forEach((i) => { if (i.noKas) existingNoKasSet.add(i.noKas.toUpperCase()); });

  const existingCollisions: string[] = [];
  const candidateBatches = parsed.uniqueVouchers;

  let totalCandidateApprovedAmount = 0;
  let totalCandidateRealizedAmount = 0;
  let totalCandidateItemsCount = 0;

  for (const b of candidateBatches) {
    for (const it of b.items) {
      totalCandidateItemsCount++;
      totalCandidateApprovedAmount += it.approvedAmount;
      totalCandidateRealizedAmount += it.realizedAmount;
    }
  }

  const sampleBatchCodes: string[] = [];
  let importedBatchesCount = 0;
  let importedItemsCount = 0;
  let skippedExistingCount = 0;
  let failedCount = 0;

  let totalImportedApprovedAmount = 0;
  let totalImportedRealizedAmount = 0;

  const projectBreakdown: Record<string, { count: number; approvedAmount: number }> = {};
  const picBreakdown: Record<string, { count: number; approvedAmount: number }> = {};
  const categoryBreakdown: Record<string, { count: number; approvedAmount: number }> = {};

  // Step 1: Filter vouchers that already exist in DB
  const vouchersToImport: CanonicalVoucher[] = [];
  for (const v of candidateBatches) {
    if (existingNoKasSet.has(v.noKas.toUpperCase())) {
      existingCollisions.push(v.noKas);
      skippedExistingCount++;
    } else {
      vouchersToImport.push(v);
    }
  }

  const targetVouchers = options.runSampleOnly ? vouchersToImport.slice(0, 5) : vouchersToImport;

  // Process in small sequential chunks for transaction safety
  const chunkSize = 20;
  for (let cIdx = 0; cIdx < targetVouchers.length; cIdx += chunkSize) {
    const chunk = targetVouchers.slice(cIdx, cIdx + chunkSize);

    for (const v of chunk) {
      try {
        const batchCode = `BATCH-${v.noKas.replace(/[^A-Za-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
        const batchDate = v.primaryDate;

        await prisma.$transaction(async (tx) => {
          const batch = await tx.submissionBatch.create({
            data: {
              batchCode,
              noKas: v.noKas,
              accDate: batchDate,
              approvedByName: v.approvedByName,
              notes: `Impor Real Excel (${v.sourceAppearances.map((a) => `${a.sheet}:R${a.row}`).join(", ")})`,
            },
          });

          for (const it of v.items) {
            await tx.accExpenseItem.create({
              data: {
                batchId: batch.id,
                itemNo: it.itemNo,
                noKas: v.noKas,
                cashType: v.cashType,
                projectId: it.projectId,
                subUnitId: it.subUnitId || null,
                categoryId: it.categoryId,
                picId: it.picId,
                description: it.description,
                requestedAmount: it.requestedAmount,
                approvedAmount: it.approvedAmount,
                status: it.realizedAmount >= it.approvedAmount && it.approvedAmount > 0
                  ? AccStatus.FULLY_REALIZED
                  : it.realizedAmount > 0
                  ? AccStatus.PARTIALLY_REALIZED
                  : AccStatus.APPROVED,
                notes: it.notes || null,
              },
            });

            // Track breakdowns
            if (!projectBreakdown[it.projectCode]) projectBreakdown[it.projectCode] = { count: 0, approvedAmount: 0 };
            projectBreakdown[it.projectCode].count++;
            projectBreakdown[it.projectCode].approvedAmount += it.approvedAmount;

            if (!picBreakdown[it.picName]) picBreakdown[it.picName] = { count: 0, approvedAmount: 0 };
            picBreakdown[it.picName].count++;
            picBreakdown[it.picName].approvedAmount += it.approvedAmount;

            if (!categoryBreakdown[it.categoryCode]) categoryBreakdown[it.categoryCode] = { count: 0, approvedAmount: 0 };
            categoryBreakdown[it.categoryCode].count++;
            categoryBreakdown[it.categoryCode].approvedAmount += it.approvedAmount;

            totalImportedApprovedAmount += it.approvedAmount;
            totalImportedRealizedAmount += it.realizedAmount;
            importedItemsCount++;
          }

          importedBatchesCount++;
          if (sampleBatchCodes.length < 5) {
            sampleBatchCodes.push(batch.batchCode);
          }
        });
      } catch (err: unknown) {
        failedCount++;
        console.error(`Failed to import voucher ${v.noKas}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return {
    candidateBatchesCount: candidateBatches.length,
    candidateItemsCount: totalCandidateItemsCount,
    importedBatchesCount,
    importedItemsCount,
    skippedExistingCount,
    failedCount,
    totalCandidateApprovedAmount,
    totalImportedApprovedAmount,
    totalCandidateRealizedAmount,
    totalImportedRealizedAmount,
    existingCollisions,
    sampleBatchCodes,
    projectBreakdown,
    picBreakdown,
    categoryBreakdown,
  };
}

