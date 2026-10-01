import ExcelJS from "exceljs";
import { AccReportResult } from "../reports/acc-report.service";
import { RealizationReportResult } from "../reports/realization-report.service";
import { ProjectReportResult } from "../reports/project-report.service";
import { PicReportResult } from "../reports/pic-report.service";
import { CashReportResult } from "../reports/cash-report.service";
import { JournalReportResult } from "../reports/journal-report.service";

// Styling helpers
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E293B" }, // Dark slate
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 11,
  bold: true,
  color: { argb: "FFFFFFFF" },
};

const TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F5F9" }, // Slate 100
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

const DOUBLE_BOTTOM_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "double", color: { argb: "FF1E293B" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

// ----------------------------------------------------
// 1. REKAP ACC EXCEL
// ----------------------------------------------------
export async function buildAccExcel(data: AccReportResult): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProTrack System";
  const ws = wb.addWorksheet("Rekap ACC");

  // Title Block
  ws.addRow(["PROTRACK — LAPORAN REKAPITULASI PENGAJUAN ACC"]);
  ws.addRow([`Periode: ${data.filterMeta.periodText} | Proyek: ${data.filterMeta.projectText} | PIC: ${data.filterMeta.picText}`]);
  ws.addRow([`Status: ${data.filterMeta.statusText} | Dicetak: ${new Date().toLocaleString("id-ID")}`]);
  ws.addRow([]); // Blank line

  ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
  ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true };
  ws.getCell("A3").font = { name: "Calibri", size: 10, color: { argb: "FF64748B" } };

  // Table Headers (Row 5)
  const headerRow = ws.addRow([
    "No Kas",
    "Tanggal ACC",
    "Proyek",
    "Sub-Unit",
    "Kategori",
    "PIC",
    "Uraian Pengeluaran",
    "Nominal ACC",
    "Realisasi",
    "Outstanding",
    "Status",
  ]);

  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });

  // Data Rows
  data.items.forEach((item) => {
    const row = ws.addRow([
      item.noKas,
      item.accDate.toISOString().slice(0, 10),
      item.projectCode,
      item.subUnitCode || "-",
      item.categoryName,
      item.picName,
      item.description,
      item.approvedAmount,
      item.realizedAmount,
      item.outstandingAmount,
      item.status,
    ]);

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = THIN_BORDER;
      cell.font = { name: "Calibri", size: 10 };
      if ([8, 9, 10].includes(colNum)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      } else if (colNum === 2) {
        cell.alignment = { horizontal: "center" };
      } else if ([1, 3, 4, 11].includes(colNum)) {
        cell.alignment = { horizontal: "center" };
      }
    });
  });

  // Total Row
  const totalRow = ws.addRow([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    `${data.items.length} item`,
    data.totals.totalApproved,
    data.totals.totalRealized,
    data.totals.totalOutstanding,
    "",
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.fill = TOTAL_FILL;
    cell.font = { name: "Calibri", size: 10, bold: true };
    cell.border = DOUBLE_BOTTOM_BORDER;
    if ([8, 9, 10].includes(colNum)) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: "right" };
    }
  });

  // Auto-width & freezing
  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.autoFilter = { from: "A5", to: `K${5 + data.items.length}` };

  ws.columns = [
    { width: 16 }, // No Kas
    { width: 14 }, // Tanggal
    { width: 14 }, // Proyek
    { width: 14 }, // Sub
    { width: 18 }, // Kategori
    { width: 16 }, // PIC
    { width: 35 }, // Uraian
    { width: 18 }, // ACC
    { width: 18 }, // Realisasi
    { width: 18 }, // Outstanding
    { width: 18 }, // Status
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ----------------------------------------------------
// 2. REALISASI EXCEL
// ----------------------------------------------------
export async function buildRealizationExcel(data: RealizationReportResult): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProTrack System";
  const ws = wb.addWorksheet("Realisasi");

  ws.addRow(["PROTRACK — LAPORAN REALISASI PENCAIRAN DANA"]);
  ws.addRow([`Periode: ${data.filterMeta.periodText} | Proyek: ${data.filterMeta.projectText} | Akun: ${data.filterMeta.accountText}`]);
  ws.addRow([`Status: ${data.filterMeta.statusText} | Dicetak: ${new Date().toLocaleString("id-ID")}`]);
  ws.addRow([]);

  ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
  ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true };

  const headerRow = ws.addRow([
    "Tanggal Pencairan",
    "No. Voucher",
    "No Kas ACC",
    "Proyek",
    "PIC",
    "Akun Pembayar",
    "Metode",
    "Uraian Item",
    "Nominal Dicairkan",
    "Status",
  ]);

  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });

  data.items.forEach((item) => {
    const row = ws.addRow([
      item.disbursementDate.toISOString().slice(0, 10),
      item.voucherNumber,
      item.noKas,
      item.projectCode,
      item.picName,
      item.payerAccountName,
      item.paymentMethod,
      item.description,
      item.realizedAmount,
      item.status,
    ]);

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = THIN_BORDER;
      cell.font = { name: "Calibri", size: 10 };
      if (colNum === 9) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      } else if ([1, 2, 3, 4, 7, 10].includes(colNum)) {
        cell.alignment = { horizontal: "center" };
      }
    });
  });

  const totalRow = ws.addRow([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    `${data.items.length} item`,
    data.totals.totalRealized,
    "",
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.fill = TOTAL_FILL;
    cell.font = { name: "Calibri", size: 10, bold: true };
    cell.border = DOUBLE_BOTTOM_BORDER;
    if (colNum === 9) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: "right" };
    }
  });

  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.autoFilter = { from: "A5", to: `J${5 + data.items.length}` };

  ws.columns = [
    { width: 16 }, // Tanggal
    { width: 18 }, // Voucher
    { width: 16 }, // No Kas
    { width: 14 }, // Proyek
    { width: 16 }, // PIC
    { width: 22 }, // Akun
    { width: 14 }, // Metode
    { width: 35 }, // Uraian
    { width: 20 }, // Nominal
    { width: 14 }, // Status
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ----------------------------------------------------
// 3. PER PROJECT EXCEL
// ----------------------------------------------------
export async function buildProjectExcel(data: ProjectReportResult): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProTrack System";
  const ws = wb.addWorksheet("Per Project");

  ws.addRow(["PROTRACK — LAPORAN REKAPITULASI DANA PER PROYEK"]);
  ws.addRow([`Periode: ${data.filterMeta.periodText} | Dicetak: ${new Date().toLocaleString("id-ID")}`]);
  ws.addRow([]);

  ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
  ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true };

  const headerRow = ws.addRow([
    "Kode",
    "Nama Proyek / Kategori Biaya",
    "Total Disetujui (ACC)",
    "Terealisasi (Keluar)",
    "Sisa Outstanding",
    "Progres",
  ]);

  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });

  data.projects.forEach((proj) => {
    const pct = proj.approvedAmount > 0 ? (proj.realizedAmount / proj.approvedAmount) * 100 : 0;
    // Parent Project Row
    const pRow = ws.addRow([
      proj.projectCode,
      proj.projectName,
      proj.approvedAmount,
      proj.realizedAmount,
      proj.outstandingAmount,
      `${pct.toFixed(1)}%`,
    ]);
    pRow.height = 22;
    pRow.eachCell((cell, colNum) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cell.font = { name: "Calibri", size: 10, bold: true };
      cell.border = THIN_BORDER;
      if ([3, 4, 5].includes(colNum)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      } else if (colNum === 6) {
        cell.alignment = { horizontal: "center" };
      }
    });

    // Breakdown categories under project
    proj.categories.forEach((cat) => {
      const catPct = cat.approvedAmount > 0 ? (cat.realizedAmount / cat.approvedAmount) * 100 : 0;
      const cRow = ws.addRow([
        `  ↳ ${cat.categoryCode}`,
        cat.categoryName,
        cat.approvedAmount,
        cat.realizedAmount,
        cat.outstandingAmount,
        `${catPct.toFixed(1)}%`,
      ]);
      cRow.height = 19;
      cRow.eachCell((cell, colNum) => {
        cell.font = { name: "Calibri", size: 9, italic: true };
        cell.border = THIN_BORDER;
        if ([3, 4, 5].includes(colNum)) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: "right" };
        } else if (colNum === 6) {
          cell.alignment = { horizontal: "center" };
        }
      });
    });
  });

  // Overall Total
  const totalPct = data.totals.totalApproved > 0
    ? (data.totals.totalRealized / data.totals.totalApproved) * 100
    : 0;

  const totalRow = ws.addRow([
    "TOTAL KESELURUHAN",
    `${data.totals.projectCount} Proyek`,
    data.totals.totalApproved,
    data.totals.totalRealized,
    data.totals.totalOutstanding,
    `${totalPct.toFixed(1)}%`,
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.fill = TOTAL_FILL;
    cell.font = { name: "Calibri", size: 10, bold: true };
    cell.border = DOUBLE_BOTTOM_BORDER;
    if ([3, 4, 5].includes(colNum)) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: "right" };
    } else if (colNum === 6) {
      cell.alignment = { horizontal: "center" };
    }
  });

  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.columns = [
    { width: 18 },
    { width: 35 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 14 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ----------------------------------------------------
// 4. PER PIC EXCEL
// ----------------------------------------------------
export async function buildPicExcel(data: PicReportResult): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProTrack System";
  const ws = wb.addWorksheet("Per PIC");

  ws.addRow(["PROTRACK — LAPORAN MONITORING DISTRIBUSI PIC LAPANGAN"]);
  ws.addRow([`Periode: ${data.filterMeta.periodText} | PIC: ${data.filterMeta.picText} | Dicetak: ${new Date().toLocaleString("id-ID")}`]);
  ws.addRow([]);

  ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
  ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true };

  const headerRow = ws.addRow([
    "No Kas",
    "Tanggal ACC",
    "Proyek",
    "Kategori",
    "Uraian Transaksi",
    "Nominal ACC",
    "Realisasi",
    "Outstanding",
    "Status",
  ]);

  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });

  data.pics.forEach((p) => {
    // PIC Header Group Row
    const grpRow = ws.addRow([
      `PIC: ${p.picName} ${p.roleTitle ? `(${p.roleTitle})` : ""}`,
      "",
      "",
      "",
      `${p.itemCount} Transaksi`,
      p.approvedAmount,
      p.realizedAmount,
      p.outstandingAmount,
      "",
    ]);
    grpRow.height = 22;
    grpRow.eachCell((cell, colNum) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.font = { name: "Calibri", size: 10, bold: true };
      cell.border = THIN_BORDER;
      if ([6, 7, 8].includes(colNum)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      }
    });

    // Detail items under PIC
    p.items.forEach((item) => {
      const row = ws.addRow([
        item.noKas,
        item.accDate.toISOString().slice(0, 10),
        item.projectCode,
        item.categoryName,
        item.description,
        item.approvedAmount,
        item.realizedAmount,
        item.outstandingAmount,
        item.status,
      ]);
      row.height = 19;
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Calibri", size: 9 };
        cell.border = THIN_BORDER;
        if ([6, 7, 8].includes(colNum)) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: "right" };
        } else if ([1, 2, 3, 9].includes(colNum)) {
          cell.alignment = { horizontal: "center" };
        }
      });
    });
  });

  const totalRow = ws.addRow([
    "TOTAL",
    "",
    "",
    "",
    `${data.pics.length} PIC`,
    data.totals.totalApproved,
    data.totals.totalRealized,
    data.totals.totalOutstanding,
    "",
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.fill = TOTAL_FILL;
    cell.font = { name: "Calibri", size: 10, bold: true };
    cell.border = DOUBLE_BOTTOM_BORDER;
    if ([6, 7, 8].includes(colNum)) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: "right" };
    }
  });

  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.columns = [
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 35 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ----------------------------------------------------
// 5. KAS & BANK EXCEL
// ----------------------------------------------------
export async function buildCashExcel(data: CashReportResult): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProTrack System";
  const ws = wb.addWorksheet("Kas Bank");

  ws.addRow(["PROTRACK — LAPORAN POSISI SALDO KAS & BANK"]);
  ws.addRow([`Dicetak pada: ${new Date().toLocaleString("id-ID")}`]);
  ws.addRow([]);

  ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
  ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true };

  const headerRow = ws.addRow([
    "Kode Akun",
    "Nama Akun Kas / Bank",
    "Tipe",
    "Informasi Bank / No. Rekening",
    "Saldo Awal",
    "Penerimaan (Inflow)",
    "Pencairan (Keluar)",
    "Saldo Akhir Real-Time",
  ]);

  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });

  data.accounts.forEach((acc) => {
    const row = ws.addRow([
      acc.accountCode,
      acc.accountName,
      acc.accountType,
      acc.bankName ? `${acc.bankName} - ${acc.accountNumber || ""}` : "Kas Fisik",
      acc.openingBalance,
      acc.totalInflow,
      acc.totalDisbursement,
      acc.currentBalance,
    ]);

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = THIN_BORDER;
      cell.font = { name: "Calibri", size: 10 };
      if ([5, 6, 7, 8].includes(colNum)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      } else if ([1, 3].includes(colNum)) {
        cell.alignment = { horizontal: "center" };
      }
    });
  });

  const totalRow = ws.addRow([
    "TOTAL",
    `${data.accounts.length} Akun`,
    "",
    "",
    data.totals.totalOpening,
    data.totals.totalInflow,
    data.totals.totalDisbursement,
    data.totals.totalCurrentBalance,
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.fill = TOTAL_FILL;
    cell.font = { name: "Calibri", size: 10, bold: true };
    cell.border = DOUBLE_BOTTOM_BORDER;
    if ([5, 6, 7, 8].includes(colNum)) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: "right" };
    }
  });

  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.columns = [
    { width: 18 },
    { width: 28 },
    { width: 14 },
    { width: 28 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 24 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ----------------------------------------------------
// 6. JURNAL AKUNTANSI EXCEL
// ----------------------------------------------------
export async function buildJournalExcel(data: JournalReportResult): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProTrack System";
  const ws = wb.addWorksheet("Jurnal");

  ws.addRow(["PROTRACK — LAPORAN BUKU JURNAL UMUM"]);
  ws.addRow([`Periode: ${data.filterMeta.periodText} | Sumber: ${data.filterMeta.sourceText} | Status: ${data.filterMeta.statusText}`]);
  ws.addRow([`Dicetak pada: ${new Date().toLocaleString("id-ID")}`]);
  ws.addRow([]);

  ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
  ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true };

  const headerRow = ws.addRow([
    "Tanggal",
    "No. Jurnal",
    "Sumber Transaksi",
    "Keterangan / Uraian",
    "Kode Akun",
    "Nama Akun (COA)",
    "Debit (Rp)",
    "Kredit (Rp)",
    "Status",
  ]);

  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });

  data.rows.forEach((rowItem) => {
    const row = ws.addRow([
      rowItem.entryDate.toISOString().slice(0, 10),
      rowItem.journalNumber,
      rowItem.sourceType,
      rowItem.memo || rowItem.description,
      rowItem.accountCode,
      rowItem.accountName,
      rowItem.debit,
      rowItem.credit,
      rowItem.status,
    ]);

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = THIN_BORDER;
      cell.font = { name: "Calibri", size: 10 };
      if ([7, 8].includes(colNum)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      } else if ([1, 2, 3, 5, 9].includes(colNum)) {
        cell.alignment = { horizontal: "center" };
      }
    });
  });

  const totalRow = ws.addRow([
    "TOTAL (POSTED ONLY)",
    "",
    "",
    "",
    "",
    "",
    data.totals.totalDebit,
    data.totals.totalCredit,
    data.totals.totalDebit === data.totals.totalCredit ? "BALANCED" : "UNBALANCED",
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.fill = TOTAL_FILL;
    cell.font = { name: "Calibri", size: 10, bold: true };
    cell.border = DOUBLE_BOTTOM_BORDER;
    if ([7, 8].includes(colNum)) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: "right" };
    } else if (colNum === 9) {
      cell.alignment = { horizontal: "center" };
      cell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: data.totals.totalDebit === data.totals.totalCredit ? "FF16A34A" : "FFDC2626" },
      };
    }
  });

  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.autoFilter = { from: "A5", to: `I${5 + data.rows.length}` };

  ws.columns = [
    { width: 14 }, // Tanggal
    { width: 22 }, // No Jurnal
    { width: 18 }, // Sumber
    { width: 35 }, // Keterangan
    { width: 14 }, // Kode Akun
    { width: 25 }, // Nama Akun
    { width: 20 }, // Debit
    { width: 20 }, // Kredit
    { width: 14 }, // Status
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
