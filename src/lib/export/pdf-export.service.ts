import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AccReportResult } from "../reports/acc-report.service";
import { RealizationReportResult } from "../reports/realization-report.service";
import { ProjectReportResult } from "../reports/project-report.service";
import { PicReportResult } from "../reports/pic-report.service";
import { CashReportResult } from "../reports/cash-report.service";
import { JournalReportResult } from "../reports/journal-report.service";
import { formatRupiah, formatDate } from "../utils/format";

const runAutoTable = ((autoTable as any).default || autoTable) as typeof autoTable;

function addHeader(
  doc: jsPDF,
  title: string,
  filterSub: string,
  orientation: "landscape" | "portrait"
) {
  const pageWidth = orientation === "landscape" ? 297 : 210;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text("ProTrack — Project Administration System", 14, 15);

  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(title, 14, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(filterSub, 14, 28);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, pageWidth - 14, 28, {
    align: "right",
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(14, 31, pageWidth - 14, 31);
}

function addFooter(doc: jsPDF, orientation: "landscape" | "portrait") {
  const pageHeight = orientation === "landscape" ? 210 : 297;
  const pageWidth = orientation === "landscape" ? 297 : 210;
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Dokumen ini digenerate secara otomatis oleh ProTrack Financial Administration",
      14,
      pageHeight - 8
    );
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, pageHeight - 8, {
      align: "right",
    });
  }
}

// ----------------------------------------------------
// 1. REKAP ACC PDF (Landscape)
// ----------------------------------------------------
export async function buildAccPdf(data: AccReportResult): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addHeader(
    doc,
    "Laporan Rekapitulasi Pengajuan ACC",
    `Periode: ${data.filterMeta.periodText} | Proyek: ${data.filterMeta.projectText} | PIC: ${data.filterMeta.picText} | Status: ${data.filterMeta.statusText}`,
    "landscape"
  );

  const head = [
    [
      "No Kas",
      "Tanggal",
      "Proyek",
      "Sub",
      "Kategori",
      "PIC",
      "Uraian Pengeluaran",
      "Nominal ACC",
      "Realisasi",
      "Outstanding",
      "Status",
    ],
  ];

  const body = data.items.map((i) => [
    i.noKas,
    formatDate(i.accDate),
    i.projectCode,
    i.subUnitCode || "-",
    i.categoryName,
    i.picName,
    i.description,
    formatRupiah(i.approvedAmount),
    formatRupiah(i.realizedAmount),
    formatRupiah(i.outstandingAmount),
    i.status,
  ]);

  const foot = [
    [
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      `${data.items.length} item`,
      formatRupiah(data.totals.totalApproved),
      formatRupiah(data.totals.totalRealized),
      formatRupiah(data.totals.totalOutstanding),
      "",
    ],
  ];

  runAutoTable(doc, {
    head,
    body,
    foot,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 16 },
      2: { cellWidth: 16 },
      3: { cellWidth: 14 },
      4: { cellWidth: 22 },
      5: { cellWidth: 20 },
      6: { cellWidth: "auto" },
      7: { halign: "right", cellWidth: 24 },
      8: { halign: "right", cellWidth: 24 },
      9: { halign: "right", cellWidth: 24 },
      10: { halign: "center", cellWidth: 22 },
    },
  });

  addFooter(doc, "landscape");
  return new Uint8Array(doc.output("arraybuffer"));
}

// ----------------------------------------------------
// 2. REALISASI PDF (Landscape)
// ----------------------------------------------------
export async function buildRealizationPdf(data: RealizationReportResult): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addHeader(
    doc,
    "Laporan Realisasi Pencairan Dana",
    `Periode: ${data.filterMeta.periodText} | Proyek: ${data.filterMeta.projectText} | Akun: ${data.filterMeta.accountText} | Status: ${data.filterMeta.statusText}`,
    "landscape"
  );

  const head = [
    [
      "Tanggal",
      "No. Voucher",
      "No Kas",
      "Proyek",
      "PIC",
      "Akun Pembayar",
      "Metode",
      "Uraian Item",
      "Nominal Dicairkan",
      "Status",
    ],
  ];

  const body = data.items.map((i) => [
    formatDate(i.disbursementDate),
    i.voucherNumber,
    i.noKas,
    i.projectCode,
    i.picName,
    i.payerAccountName,
    i.paymentMethod,
    i.description,
    formatRupiah(i.realizedAmount),
    i.status,
  ]);

  const foot = [
    [
      "TOTAL (POSTED ONLY)",
      "",
      "",
      "",
      "",
      "",
      "",
      `${data.items.length} item`,
      formatRupiah(data.totals.totalRealized),
      "",
    ],
  ];

  runAutoTable(doc, {
    head,
    body,
    foot,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 18 },
      4: { cellWidth: 22 },
      5: { cellWidth: 28 },
      6: { cellWidth: 16, halign: "center" },
      7: { cellWidth: "auto" },
      8: { halign: "right", cellWidth: 28 },
      9: { halign: "center", cellWidth: 18 },
    },
  });

  addFooter(doc, "landscape");
  return new Uint8Array(doc.output("arraybuffer"));
}

// ----------------------------------------------------
// 3. PER PROJECT PDF (Portrait)
// ----------------------------------------------------
export async function buildProjectPdf(data: ProjectReportResult): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addHeader(
    doc,
    "Laporan Rekapitulasi Alokasi Dana per Proyek",
    `Periode: ${data.filterMeta.periodText} | Proyek: ${data.filterMeta.projectText}`,
    "portrait"
  );

  const tableBody: (string | { content: string; colSpan?: number; styles?: any })[][] = [];

  data.projects.forEach((proj) => {
    const pct = proj.approvedAmount > 0 ? (proj.realizedAmount / proj.approvedAmount) * 100 : 0;
    // Parent project row
    tableBody.push([
      {
        content: `PROYEK: ${proj.projectCode} — ${proj.projectName} (${proj.itemCount} item)`,
        styles: { fontStyle: "bold", fillColor: [241, 245, 249] },
      },
      { content: formatRupiah(proj.approvedAmount), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
      { content: formatRupiah(proj.realizedAmount), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
      { content: formatRupiah(proj.outstandingAmount), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
      { content: `${pct.toFixed(1)}%`, styles: { fontStyle: "bold", halign: "center", fillColor: [241, 245, 249] } },
    ]);

    // Categories breakdown
    proj.categories.forEach((cat) => {
      const catPct = cat.approvedAmount > 0 ? (cat.realizedAmount / cat.approvedAmount) * 100 : 0;
      tableBody.push([
        `   ↳ ${cat.categoryCode} - ${cat.categoryName}`,
        formatRupiah(cat.approvedAmount),
        formatRupiah(cat.realizedAmount),
        formatRupiah(cat.outstandingAmount),
        `${catPct.toFixed(1)}%`,
      ]);
    });
  });

  const totalPct = data.totals.totalApproved > 0
    ? (data.totals.totalRealized / data.totals.totalApproved) * 100
    : 0;

  const foot = [
    [
      `TOTAL KESELURUHAN (${data.totals.projectCount} Proyek)`,
      formatRupiah(data.totals.totalApproved),
      formatRupiah(data.totals.totalRealized),
      formatRupiah(data.totals.totalOutstanding),
      `${totalPct.toFixed(1)}%`,
    ],
  ];

  runAutoTable(doc, {
    head: [["Proyek & Kategori Biaya", "Disetujui (ACC)", "Terealisasi", "Sisa Outstanding", "Progres"]],
    body: tableBody,
    foot,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 32 },
      2: { halign: "right", cellWidth: 32 },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "center", cellWidth: 20 },
    },
  });

  addFooter(doc, "portrait");
  return new Uint8Array(doc.output("arraybuffer"));
}

// ----------------------------------------------------
// 4. PER PIC PDF (Landscape)
// ----------------------------------------------------
export async function buildPicPdf(data: PicReportResult): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addHeader(
    doc,
    "Laporan Monitoring Distribusi PIC Lapangan",
    `Periode: ${data.filterMeta.periodText} | PIC: ${data.filterMeta.picText} | Status: ${data.filterMeta.statusText}`,
    "landscape"
  );

  const tableBody: any[] = [];

  data.pics.forEach((p) => {
    tableBody.push([
      {
        content: `PIC: ${p.picName} ${p.roleTitle ? `(${p.roleTitle})` : ""} — ${p.itemCount} Transaksi`,
        colSpan: 4,
        styles: { fontStyle: "bold", fillColor: [241, 245, 249] },
      },
      { content: formatRupiah(p.approvedAmount), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
      { content: formatRupiah(p.realizedAmount), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
      { content: formatRupiah(p.outstandingAmount), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
      { content: "", styles: { fillColor: [241, 245, 249] } },
    ]);

    p.items.forEach((item) => {
      tableBody.push([
        item.noKas,
        formatDate(item.accDate),
        item.projectCode,
        item.description,
        formatRupiah(item.approvedAmount),
        formatRupiah(item.realizedAmount),
        formatRupiah(item.outstandingAmount),
        item.status,
      ]);
    });
  });

  const foot = [
    [
      "TOTAL",
      "",
      "",
      `${data.pics.length} PIC`,
      formatRupiah(data.totals.totalApproved),
      formatRupiah(data.totals.totalRealized),
      formatRupiah(data.totals.totalOutstanding),
      "",
    ],
  ];

  runAutoTable(doc, {
    head: [["No Kas", "Tanggal", "Proyek", "Uraian", "Nominal ACC", "Realisasi", "Outstanding", "Status"]],
    body: tableBody,
    foot,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { cellWidth: "auto" },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 28 },
      6: { halign: "right", cellWidth: 28 },
      7: { halign: "center", cellWidth: 22 },
    },
  });

  addFooter(doc, "landscape");
  return new Uint8Array(doc.output("arraybuffer"));
}

// ----------------------------------------------------
// 5. KAS & BANK PDF (Portrait)
// ----------------------------------------------------
export async function buildCashPdf(data: CashReportResult): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addHeader(doc, "Laporan Posisi Saldo Kas & Bank", "Posisi Saldo Real-Time Rekening Operasional", "portrait");

  const head = [["Akun & Rekening", "Tipe", "Saldo Awal", "Inflow (Masuk)", "Pencairan (Keluar)", "Saldo Akhir"]];

  const body = data.accounts.map((a) => [
    `${a.accountName}\n${a.bankName ? `${a.bankName} - ${a.accountNumber || ""}` : a.accountCode}`,
    a.accountType,
    formatRupiah(a.openingBalance),
    formatRupiah(a.totalInflow),
    formatRupiah(a.totalDisbursement),
    formatRupiah(a.currentBalance),
  ]);

  const foot = [
    [
      "TOTAL KESELURUHAN",
      `${data.accounts.length} Akun`,
      formatRupiah(data.totals.totalOpening),
      formatRupiah(data.totals.totalInflow),
      formatRupiah(data.totals.totalDisbursement),
      formatRupiah(data.totals.totalCurrentBalance),
    ],
  ];

  runAutoTable(doc, {
    head,
    body,
    foot,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "right", cellWidth: 26 },
      3: { halign: "right", cellWidth: 26 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", cellWidth: 30, fontStyle: "bold" },
    },
  });

  addFooter(doc, "portrait");
  return new Uint8Array(doc.output("arraybuffer"));
}

// ----------------------------------------------------
// 6. JURNAL PDF (Landscape)
// ----------------------------------------------------
export async function buildJournalPdf(data: JournalReportResult): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addHeader(
    doc,
    "Laporan Buku Jurnal Umum (Double-Entry)",
    `Periode: ${data.filterMeta.periodText} | Sumber: ${data.filterMeta.sourceText} | Status: ${data.filterMeta.statusText}`,
    "landscape"
  );

  const head = [
    ["Tanggal", "No. Jurnal", "Sumber", "Keterangan", "Kode Akun", "Nama Akun (COA)", "Debit (Rp)", "Kredit (Rp)", "Status"],
  ];

  const body = data.rows.map((r) => [
    formatDate(r.entryDate),
    r.journalNumber,
    r.sourceType,
    r.memo || r.description,
    r.accountCode,
    r.accountName,
    r.debit > 0 ? formatRupiah(r.debit) : "-",
    r.credit > 0 ? formatRupiah(r.credit) : "-",
    r.status,
  ]);

  const foot = [
    [
      "TOTAL (POSTED ONLY)",
      "",
      "",
      "",
      "",
      data.totals.totalDebit === data.totals.totalCredit ? "BALANCED" : "UNBALANCED",
      formatRupiah(data.totals.totalDebit),
      formatRupiah(data.totals.totalCredit),
      "",
    ],
  ];

  runAutoTable(doc, {
    head,
    body,
    foot,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 26 },
      2: { cellWidth: 24 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 32 },
      6: { halign: "right", cellWidth: 26 },
      7: { halign: "right", cellWidth: 26 },
      8: { halign: "center", cellWidth: 18 },
    },
  });

  addFooter(doc, "landscape");
  return new Uint8Array(doc.output("arraybuffer"));
}
