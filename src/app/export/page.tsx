"use client";

import { useState } from "react";
import { DownloadIcon } from "../components/Icons";

const exportCards = [
  {
    type: "acc",
    title: "Rekap Data ACC",
    code: "EXP-ACC",
    description: "Seluruh baris transaksi ACC yang telah disetujui, tanggal, proyek, PIC, dan status realisasi.",
  },
  {
    type: "realization",
    title: "Realisasi Pencairan",
    code: "EXP-REAL",
    description: "Rincian voucher pengeluaran, akun pembayar, nomor pencairan, dan nilai realisasi.",
  },
  {
    type: "project",
    title: "Alokasi per Proyek",
    code: "EXP-PROJ",
    description: "Akumulasi nilai ACC per proyek dan sub-unit, realisasi pengeluaran, serta persentase progres.",
  },
  {
    type: "pic",
    title: "Beban per PIC",
    code: "EXP-PIC",
    description: "Rincian alokasi dan penyerapan dana per penanggung jawab/mandor di lapangan.",
  },
  {
    type: "cash",
    title: "Kas & Bank",
    code: "EXP-CASH",
    description: "Arus kas masuk dan keluar per akun rekening, serta saldo likuiditas akhir.",
  },
  {
    type: "journal",
    title: "Buku Jurnal",
    code: "EXP-JRNL",
    description: "Daftar ayat jurnal double-entry otomatis (Debit/Kredit) dari seluruh transaksi terposting.",
  },
];

export default function ExportPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const buildUrl = (type: string, format: "excel" | "pdf") => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return `/api/export/${format}?${params.toString()}`;
  };

  const handleResetDates = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Export Laporan</h1>
          <div className="page-header-subtitle">
            Unduh rekapitulasi administrasi dan keuangan ProTrack.
          </div>
        </div>
        <a
          href="/api/templates/acc-import"
          className="btn btn-secondary btn-sm"
          download
        >
          <DownloadIcon size={14} />
          <span>Unduh Template Import Excel</span>
        </a>
      </div>

      <div className="page-body">
        {/* Date Filter Bar */}
        <div className="card mb-6">
          <div className="card-header">
            <h2>Filter Periode Tanggal</h2>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleResetDates}
                className="btn btn-ghost btn-sm text-xs"
              >
                Reset Periode
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="form-row" style={{ alignItems: "flex-end" }}>
              <div className="form-group" style={{ marginBottom: 0, maxWidth: 220 }}>
                <label className="form-label text-xs">Mulai Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, maxWidth: 220 }}>
                <label className="form-label text-xs">Sampai Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <span className="text-xs text-muted">
                  {startDate || endDate
                    ? `Periode aktif: ${startDate || "Awal"} s/d ${endDate || "Sekarang"}`
                    : "Kosongkan untuk mengekspor seluruh periode data historis"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 6 Report Types as Clean Compact List Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 16,
          }}
        >
          {exportCards.map((card, idx) => (
            <div key={card.type} className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 font-mono">
                    0{idx + 1}
                  </span>
                  <h2 style={{ fontSize: "0.92rem" }}>{card.title}</h2>
                </div>
                <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                  {card.code}
                </span>
              </div>

              <div className="card-body" style={{ flex: 1, padding: "14px 20px" }}>
                <p className="text-xs text-secondary" style={{ lineHeight: 1.5 }}>
                  {card.description}
                </p>
              </div>

              <div
                style={{
                  padding: "10px 16px",
                  background: "var(--slate-50)",
                  borderTop: "1px solid var(--color-border-subtle)",
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <a
                  href={buildUrl(card.type, "excel")}
                  className="btn btn-secondary btn-sm"
                  download
                  title="Unduh format spreadsheet Microsoft Excel (.xlsx)"
                  style={{ textDecoration: "none" }}
                >
                  <DownloadIcon size={12} />
                  <span>Excel (.xlsx)</span>
                </a>
                <a
                  href={buildUrl(card.type, "pdf")}
                  className="btn btn-secondary btn-sm"
                  download
                  title="Unduh format dokumen cetak PDF (.pdf)"
                  style={{ textDecoration: "none" }}
                >
                  <DownloadIcon size={12} />
                  <span>PDF (.pdf)</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
