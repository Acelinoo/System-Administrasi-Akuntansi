"use client";

import { useState } from "react";

const exportCards = [
  {
    type: "acc",
    title: "Rekapitulasi Data ACC",
    icon: "📋",
    description: "Seluruh baris transaksi ACC yang telah disetujui, tanggal, proyek, PIC, dan status realisasi.",
    defaultFilename: "ProTrack_Rekap_ACC",
  },
  {
    type: "realization",
    title: "Realisasi Pencairan (Disbursement)",
    icon: "💸",
    description: "Rincian voucher pengeluaran, akun pembayar, nomor pencairan, dan nilai realisasi.",
    defaultFilename: "ProTrack_Realisasi",
  },
  {
    type: "project",
    title: "Alokasi Dana per Proyek",
    icon: "🏗️",
    description: "Akumulasi nilai ACC per proyek dan sub-unit, realisasi pengeluaran, serta persentase progres.",
    defaultFilename: "ProTrack_Per_Project",
  },
  {
    type: "pic",
    title: "Distribusi Beban per PIC Lapangan",
    icon: "👷",
    description: "Rincian alokasi dan penyerapan dana per penanggung jawab/mandor di lapangan.",
    defaultFilename: "ProTrack_Per_PIC",
  },
  {
    type: "cash",
    title: "Rekap Mutasi Kas & Saldo Bank",
    icon: "🏦",
    description: "Arus kas masuk dan keluar per akun rekening, serta saldo likuiditas akhir.",
    defaultFilename: "ProTrack_Kas_Bank",
  },
  {
    type: "journal",
    title: "Buku Jurnal Akuntansi",
    icon: "📒",
    description: "Daftar ayat jurnal double-entry otomatis (Debit/Kredit) dari seluruh transaksi terposting.",
    defaultFilename: "ProTrack_Buku_Jurnal",
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
          <h1>Pusat Export Data & Laporan</h1>
          <div className="page-header-subtitle">
            Unduh rekapitulasi data ACC, realisasi pencairan, laporan proyek, dan pembukuan dalam format Excel (.xlsx) atau PDF (.pdf)
          </div>
        </div>
        <a
          href="/api/templates/acc-import"
          className="btn btn-secondary btn-sm"
          download
        >
          📥 Unduh Template Import Excel
        </a>
      </div>

      <div className="page-body">
        {/* Date Filter Card */}
        <div className="card mb-6">
          <div className="card-header">
            <h2>Filter Periode Tanggal (Opsional)</h2>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleResetDates}
                className="btn btn-ghost btn-sm text-xs text-secondary"
              >
                Reset Filter Tanggal
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group" style={{ maxWidth: 280 }}>
                <label className="form-label text-xs">Tanggal Mulai</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ maxWidth: 280 }}>
                <label className="form-label text-xs">Tanggal Akhir</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "var(--space-1)" }}>
                <span className="text-xs text-muted">
                  {startDate || endDate
                    ? `Export akan dibatasi antara ${startDate || "awal"} s/d ${endDate || "sekarang"}`
                    : "Kosongkan tanggal untuk mengekspor seluruh periode data"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {exportCards.map((card) => (
            <div key={card.type} className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "1.3rem" }}>{card.icon}</span>
                  <h2 style={{ fontSize: "1rem" }}>{card.title}</h2>
                </div>
              </div>
              <div className="card-body" style={{ flex: 1 }}>
                <p className="text-sm text-secondary" style={{ lineHeight: 1.5 }}>
                  {card.description}
                </p>
              </div>
              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--bg-subtle)",
                  borderTop: "1px solid var(--border-color)",
                  display: "flex",
                  gap: "var(--space-2)",
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
                  <span>📊</span>
                  <span>Excel (.xlsx)</span>
                </a>
                <a
                  href={buildUrl(card.type, "pdf")}
                  className="btn btn-secondary btn-sm"
                  download
                  title="Unduh format dokumen cetak PDF (.pdf)"
                  style={{ textDecoration: "none" }}
                >
                  <span>📄</span>
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
