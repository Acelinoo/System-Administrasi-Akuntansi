"use client";

import React, { useState } from "react";
import Link from "next/link";
import { previewExcelImportAction, confirmExcelImportAction } from "../../actions/import.actions";
import { ImportPreviewResult } from "@/lib/finance/import.service";
import { DownloadIcon, UploadIcon, DocumentIcon, CloseIcon } from "../../components/Icons";

export default function ImportWizard() {
  // Wizard state
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview Data & Pagination
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Batch Form inputs
  const [batchCode, setBatchCode] = useState(() => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `BATCH-IMP-${today}-${Math.floor(100 + Math.random() * 900)}`;
  });
  const [accDate, setAccDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [approvedByName, setApprovedByName] = useState("Pa Giri");
  const [notes, setNotes] = useState("Impor Data Excel Terkontrol");

  // Success State
  const [importResult, setImportResult] = useState<{
    batchCode: string;
    importedCount: number;
    totalApprovedAmount: number;
  } | null>(null);

  // Handle file drop/change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setErrorMessage(null);
      setImportResult(null);
      setPage(1);
    }
  };

  // Step 1: Trigger Preview Analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Pilih file spreadsheet Excel terlebih dahulu.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await previewExcelImportAction(formData);
      if (!res.success || !res.data) {
        setErrorMessage(res.error || "Gagal menganalisis file Excel.");
      } else {
        setPreview(res.data);
        setPage(1);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan sistem saat membaca file.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Confirm and Execute Import
  const handleConfirmImport = async () => {
    if (!preview) return;

    const validRows = preview.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage("Tidak ada baris data yang valid untuk diimpor. Semua baris bermasalah atau sudah pernah terdaftar di database.");
      return;
    }

    if (!batchCode.trim()) {
      setErrorMessage("Kode Batch wajib diisi.");
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const payload = {
        batchCode: batchCode.trim(),
        accDate,
        approvedByName: approvedByName.trim() || "Pa Giri",
        notes: notes.trim() || null,
        items: validRows.map((r) => ({
          noKas: r.resolvedNoKas,
          cashType: r.resolvedCashType,
          projectId: r.resolvedProjectId!,
          subUnitId: r.resolvedSubUnitId || null,
          categoryId: r.resolvedCategoryId!,
          subCategoryId: r.resolvedSubCategoryId || null,
          picId: r.resolvedPicId!,
          description: r.rawDescription,
          requestedAmount: r.rawRequestedAmount || null,
          approvedAmount: r.rawApprovedAmount,
          notes: r.rawNotes || null,
        })),
      };

      const res = await confirmExcelImportAction(payload);
      if (!res.success || !res.data) {
        setErrorMessage(res.error || "Gagal melakukan impor ke database.");
      } else {
        setImportResult(res.data);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan transaksi database.");
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Pagination slice
  const totalRowsCount = preview ? preview.rows.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalRowsCount / pageSize));
  const displayedRows = preview
    ? preview.rows.slice((page - 1) * pageSize, page * pageSize)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Top Header & Navigation */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", color: "var(--slate-500)", marginBottom: "4px" }}>
            <Link href="/acc" style={{ color: "var(--slate-600)", textDecoration: "none" }}>
              Data ACC
            </Link>
            <span>/</span>
            <span style={{ color: "var(--slate-800)", fontWeight: 600 }}>Impor Excel</span>
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--slate-900)" }}>
            Impor Data ACC Excel
          </h1>
          <div style={{ fontSize: "0.82rem", color: "var(--slate-500)", marginTop: "2px" }}>
            Validasi transaksi ACC dari spreadsheet. Mendukung format asli Workbook Rekap Pengajuan 2026 (44 Sheet) dan Template Standar.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <a
            href="/api/templates/acc-import"
            className="btn btn-secondary"
            title="Unduh file template Excel standar ProTrack"
          >
            <DownloadIcon size={14} />
            <span>Unduh Template Excel</span>
          </a>
          <Link href="/acc" className="btn btn-secondary">
            <span>Batal</span>
          </Link>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="alert alert-error" style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <div style={{ flex: 1 }}>
            <strong>Terjadi Kesalahan: </strong>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="btn-ghost"
            style={{ padding: 0, border: "none", color: "inherit", cursor: "pointer" }}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* STEP 3: SUCCESS RESULT */}
      {importResult ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: "center", padding: "var(--space-8) var(--space-6)" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--green-50)",
                border: "1px solid var(--green-100)",
                color: "var(--green-700)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "var(--space-4)",
              }}
            >
              <DocumentIcon size={24} />
            </div>

            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--slate-900)", marginBottom: "4px" }}>
              Impor Data Berhasil Disimpan
            </h2>
            <p style={{ fontSize: "0.84rem", color: "var(--slate-500)", maxWidth: 520, margin: "0 auto var(--space-6)" }}>
              Seluruh baris transaksi valid telah diverifikasi dan disimpan ke database dalam satu batch transaksi terkontrol.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "var(--space-4)",
                maxWidth: 620,
                margin: "0 auto var(--space-6)",
                textAlign: "left",
              }}
            >
              <div style={{ background: "var(--slate-50)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", textTransform: "uppercase", fontWeight: 600 }}>Kode Batch</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--slate-900)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                  {importResult.batchCode}
                </div>
              </div>

              <div style={{ background: "var(--slate-50)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", textTransform: "uppercase", fontWeight: 600 }}>Baris Terimpor</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--green-700)", marginTop: "4px" }}>
                  {importResult.importedCount} Item
                </div>
              </div>

              <div style={{ background: "var(--slate-50)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", textTransform: "uppercase", fontWeight: 600 }}>Total Nilai ACC</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--slate-900)", marginTop: "4px" }}>
                  {formatCurrency(importResult.totalApprovedAmount)}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)" }}>
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setImportResult(null);
                  setPage(1);
                }}
                className="btn btn-secondary"
              >
                Impor File Lain
              </button>
              <Link href="/acc" className="btn btn-primary">
                Buka Daftar Data ACC
              </Link>
            </div>
          </div>
        </div>
      ) : !preview ? (
        /* STEP 1: UPLOAD & ANALYZE FORM */
        <div className="card">
          <div className="card-header">
            <h2>Pilih & Unggah File Spreadsheet</h2>
          </div>

          <div className="card-body">
            <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              <div>
                <label className="form-label" style={{ marginBottom: "var(--space-2)" }}>
                  File Spreadsheet (.xlsx / .xls)
                </label>

                {/* Dropzone Container */}
                <div
                  style={{
                    position: "relative",
                    border: "2px dashed var(--slate-300)",
                    borderRadius: "var(--radius-md)",
                    padding: "36px 20px",
                    textAlign: "center",
                    background: "var(--slate-50)",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />

                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", background: "#ffffff", border: "1px solid var(--color-border)", color: "var(--slate-600)", marginBottom: "var(--space-3)" }}>
                    <UploadIcon size={20} />
                  </div>

                  {file ? (
                    <div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--slate-900)" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--slate-500)", marginTop: "4px" }}>
                        {(file.size / 1024).toFixed(1)} KB — Klik untuk mengganti file
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--slate-800)" }}>
                        Pilih file Excel atau tarik file ke sini
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--slate-400)", marginTop: "4px" }}>
                        Mendukung Microsoft Excel .xlsx dan .xls (Maksimal 10MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Supported Formats Info */}
              <div
                style={{
                  background: "var(--slate-50)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "14px 16px",
                  fontSize: "0.76rem",
                  color: "var(--slate-600)",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--slate-800)", marginBottom: "6px" }}>
                  Format yang Didukung:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" }}>
                  <div>
                    <strong style={{ color: "var(--slate-800)" }}>A. Format Asli Workbook Rekap Pengajuan 2026</strong>
                    <div style={{ color: "var(--slate-500)", marginTop: "2px" }}>
                      Membaca otomatis 44 sheet rekapan mingguan tanpa perlu mengubah kolom header. Header seperti TGL, NO KAS, KETERANGAN PENGAJUAN, PENGAJUAN, dan SUDAH dikenali secara langsung.
                    </div>
                  </div>
                  <div>
                    <strong style={{ color: "var(--slate-800)" }}>B. Format Template Standar ProTrack</strong>
                    <div style={{ color: "var(--slate-500)", marginTop: "2px" }}>
                      File template tunggal dengan kolom: No Kas, Jenis Kas, Tanggal, Proyek, Sub Unit, Kategori, PIC, Uraian, dan Nominal ACC.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={!file || isAnalyzing}
                  className="btn btn-primary"
                  style={{ minWidth: 160 }}
                >
                  {isAnalyzing ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                        <line x1="12" y1="2" x2="12" y2="6" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                        <line x1="2" y1="12" x2="6" y2="12" />
                        <line x1="18" y1="12" x2="22" y2="12" />
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                      </svg>
                      <span>Menganalisis File...</span>
                    </>
                  ) : (
                    <>
                      <DocumentIcon size={14} />
                      <span>Analisis & Preview File</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* STEP 2: PREVIEW & CONFIRMATION */
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Format Detection Header Banner */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              background: "#ffffff",
              padding: "12px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className={`status ${preview.detectedFormat === "REAL_WORKBOOK" ? "status-approved" : "status-info"}`}>
                <span className="status-dot"></span>
                {preview.detectedFormat === "REAL_WORKBOOK"
                  ? `Format Terdeteksi: Workbook Rekap Pengajuan (${preview.recapSheetsCount || 44} Sheet Rekap)`
                  : "Format Terdeteksi: Template Standar ProTrack"}
              </span>
              <span style={{ fontSize: "0.82rem", color: "var(--slate-600)", fontWeight: 500 }}>
                {preview.fileName}
              </span>
            </div>

            <button
              onClick={() => {
                setPreview(null);
                setFile(null);
                setPage(1);
              }}
              className="btn btn-secondary btn-sm"
            >
              Ganti File
            </button>
          </div>

          {/* Metric Cards Grid */}
          <div className="stat-grid">
            <div className="stat-card">
              <div>
                <div className="stat-label">Total Baris Terbaca</div>
                <div className="stat-value">{preview.totalRows}</div>
              </div>
              <div className="stat-sub">Semua baris transaksi pada sheet</div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-label">Baris Valid</div>
                <div className="stat-value positive">{preview.validRows}</div>
              </div>
              <div className="stat-sub">Siap diimpor ke database</div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-label">Duplikasi DB (Dilewati)</div>
                <div className="stat-value warning">{preview.duplicateCount}</div>
              </div>
              <div className="stat-sub">No Kas sudah ada di database</div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-label">Total ACC Valid</div>
                <div className="stat-value primary" style={{ fontSize: "1.3rem" }}>
                  {formatCurrency(preview.totalApprovedAmount)}
                </div>
              </div>
              <div className="stat-sub">Nominal dari baris valid</div>
            </div>
          </div>

          {/* Duplicates Notice if existing batches found */}
          {preview.duplicateCount > 0 && (
            <div className="alert alert-warning" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
              <strong>Perhatian Duplikasi: </strong>
              Terdeteksi {preview.duplicateCount} voucher / No Kas yang sudah terdaftar sebelumnya di database. Baris tersebut ditandai dan dilewati secara otomatis untuk mencegah penggandaan data finansial REAL.
            </div>
          )}

          {/* Batch Information Form */}
          <div className="card">
            <div className="card-header">
              <h2>Informasi Batch Impor</h2>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Kode Batch <span style={{ color: "var(--red-600)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: "var(--font-mono)" }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Tanggal ACC <span style={{ color: "var(--red-600)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={accDate}
                    onChange={(e) => setAccDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Atasan Peng-ACC <span style={{ color: "var(--red-600)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={approvedByName}
                    onChange={(e) => setApprovedByName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan Batch</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="form-input"
                    placeholder="Catatan batch data ACC"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rows Preview Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Preview Data Transaksi ({preview.rows.length} Baris)</h2>
                <div style={{ fontSize: "0.74rem", color: "var(--slate-500)", marginTop: "2px" }}>
                  Menampilkan baris ke-{(page - 1) * pageSize + 1} sampai {Math.min(page * pageSize, preview.rows.length)}
                </div>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn btn-secondary btn-sm"
                  >
                    Sebelumnya
                  </button>
                  <span style={{ fontSize: "0.76rem", color: "var(--slate-600)", fontWeight: 500 }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </div>

            <div className="card-body-flush" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 48, textAlign: "center" }}>No</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 110 }}>No Kas</th>
                    <th style={{ width: 140 }}>Proyek</th>
                    <th style={{ width: 130 }}>Kategori</th>
                    <th style={{ width: 110 }}>PIC</th>
                    <th>Uraian</th>
                    <th style={{ width: 130, textAlign: "right" }}>Nominal ACC</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--slate-400)" }}>
                        #{row.rowNumber}
                      </td>
                      <td>
                        {row.isValid ? (
                          <span className="status status-realized">
                            <span className="status-dot"></span>
                            VALID
                          </span>
                        ) : row.issues.some((i) => i.toLowerCase().includes("sudah ada")) ? (
                          <span className="status status-partial" title="No Kas sudah ada di database">
                            <span className="status-dot"></span>
                            DUPLIKAT DB
                          </span>
                        ) : (
                          <span className="status status-cancelled" title={row.issues.join(", ")}>
                            <span className="status-dot"></span>
                            GAGAL
                          </span>
                        )}
                      </td>
                      <td className="col-mono">
                        {row.resolvedNoKas || row.rawNoKas || "-"}
                      </td>
                      <td style={{ fontWeight: 500, color: "var(--slate-900)" }}>
                        {row.resolvedProjectName || row.rawProject || "-"}
                      </td>
                      <td style={{ color: "var(--slate-700)" }}>
                        {row.resolvedCategoryName || row.rawCategory || "-"}
                      </td>
                      <td style={{ color: "var(--slate-700)" }}>
                        {row.resolvedPicName || row.rawPic || "-"}
                      </td>
                      <td style={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--slate-800)" }}>
                        {row.rawDescription}
                      </td>
                      <td className="col-num">
                        {formatCurrency(row.rawApprovedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom table pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 18px",
                  borderTop: "1px solid var(--color-border-subtle)",
                  fontSize: "0.76rem",
                  color: "var(--slate-500)",
                }}
              >
                <div>
                  Menampilkan {displayedRows.length} dari {preview.rows.length} baris
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn btn-secondary btn-sm"
                  >
                    Sebelumnya
                  </button>
                  <span style={{ padding: "0 6px", fontWeight: 600 }}>
                    {page} dari {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Confirmation Footer Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-4)",
              background: "#ffffff",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ fontSize: "0.82rem", color: "var(--slate-600)" }}>
              {preview.validRows > 0 ? (
                <span>
                  Siap mengimpor <strong style={{ color: "var(--slate-900)" }}>{preview.validRows}</strong> baris valid (Total:{" "}
                  <strong style={{ color: "var(--green-700)" }}>{formatCurrency(preview.totalApprovedAmount)}</strong>).
                </span>
              ) : (
                <span style={{ color: "var(--amber-700)", fontWeight: 500 }}>
                  Semua baris data sudah terdaftar di database atau memiliki masalah validasi. Tidak ada data baru untuk diimpor.
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                  setPage(1);
                }}
                disabled={isImporting}
                className="btn btn-secondary"
              >
                Ganti File
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={preview.validRows === 0 || isImporting}
                className="btn btn-primary"
                style={{ minWidth: 180 }}
              >
                {isImporting ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                      <line x1="12" y1="2" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                      <line x1="2" y1="12" x2="6" y2="12" />
                      <line x1="18" y1="12" x2="22" y2="12" />
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                    </svg>
                    <span>Menyimpan ke DB...</span>
                  </>
                ) : (
                  <>
                    <DocumentIcon size={14} />
                    <span>Konfirmasi & Impor ({preview.validRows} Baris)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
