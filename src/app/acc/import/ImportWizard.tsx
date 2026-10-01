"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { previewExcelImportAction, confirmExcelImportAction } from "../../actions/import.actions";
import { ImportPreviewResult } from "@/lib/finance/import.service";

export default function ImportWizard() {
  const router = useRouter();

  // Wizard state
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview Data
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);

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
      setErrorMessage("Tidak ada baris data yang valid untuk diimpor. Perbaiki file terlebih dahulu.");
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

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/acc" className="hover:underline">
              Data ACC
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Impor Data Excel</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Impor Data ACC Excel
          </h1>
          <p className="text-sm text-slate-500">
            Validasi ketat baris-per-baris, verifikasi keunikan No Kas, integritas proyek, dan isolasi transaksi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/templates/acc-import"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Unduh Template Excel
          </a>
          <Link
            href="/acc"
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
          >
            Batal
          </Link>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="font-semibold">Terjadi Kesalahan: </span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS RESULT */}
      {importResult ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Impor Data Berhasil</h2>
            <p className="text-sm text-slate-500 mt-1">
              Data hasil ACC telah berhasil divalidasi dan disimpan ke database dalam satu batch transaksi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
              <div className="text-xs text-slate-500 font-medium uppercase">Kode Batch</div>
              <div className="text-lg font-bold text-slate-800 mt-1 font-mono">{importResult.batchCode}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
              <div className="text-xs text-slate-500 font-medium uppercase">Baris Terimpor</div>
              <div className="text-lg font-bold text-emerald-700 mt-1">{importResult.importedCount} Item</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
              <div className="text-xs text-slate-500 font-medium uppercase">Total Nilai ACC</div>
              <div className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(importResult.totalApprovedAmount)}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
                setImportResult(null);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm"
            >
              Impor File Lain
            </button>
            <Link
              href="/acc"
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 shadow-sm"
            >
              Buka Daftar ACC
            </Link>
          </div>
        </div>
      ) : !preview ? (
        /* STEP 1: UPLOAD & ANALYZE FORM */
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-sm">
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Pilih File Excel (.xlsx / .xls)
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-slate-400 bg-slate-50/50 flex flex-col items-center justify-center cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <svg className="w-12 h-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024).toFixed(1)} KB — Klik untuk ganti file
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Tarik file ke sini, atau klik untuk memilih file
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Mendukung format Microsoft Excel .xlsx dan .xls (Maks. 10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Instruction Checklist */}
            <div className="bg-slate-50 rounded-md p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-800">Ketentuan File Data:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Baris 1 harus berisi Header Kolom: <code>Proyek</code>, <code>Kategori</code>, <code>PIC</code>, <code>Uraian</code>, <code>Nominal ACC</code>.</li>
                <li>Kolom <code>No Kas</code> bersifat opsional. Jika diisi, harus berformat <code>KT.YY.xxx</code> atau <code>KU.YY.xxx</code> dan belum pernah terdaftar.</li>
                <li>Proyek, Kategori, dan PIC harus sesuai dengan master data yang aktif di sistem.</li>
                <li>Sub-Unit harus terdaftar sebagai bagian sah dari Proyek yang bersangkutan.</li>
                <li>Sistem tidak akan langsung mengimpor data, melainkan memunculkan preview verifikasi terlebih dahulu.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={!file || isAnalyzing}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menganalisis & Memvalidasi...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Analisis & Preview File
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* STEP 2: PREVIEW & CONFIRMATION */
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium uppercase">Total Baris</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{preview.totalRows}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <div className="text-xs text-emerald-700 font-medium uppercase">Baris Valid</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">{preview.validRows}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-red-200 bg-red-50/20 shadow-sm">
              <div className="text-xs text-red-700 font-medium uppercase">Baris Bermasalah</div>
              <div className="text-xl font-bold text-red-700 mt-1">{preview.invalidRows}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50/20 shadow-sm">
              <div className="text-xs text-amber-700 font-medium uppercase">Duplikasi No Kas</div>
              <div className="text-xl font-bold text-amber-700 mt-1">{preview.duplicateCount}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm col-span-2 md:col-span-4 lg:col-span-1">
              <div className="text-xs text-slate-500 font-medium uppercase">Total ACC Valid</div>
              <div className="text-base font-bold text-slate-900 mt-1 truncate">
                {formatCurrency(preview.totalApprovedAmount)}
              </div>
            </div>
          </div>

          {/* Unmapped Masters Alerts */}
          {(preview.unmappedProjects.length > 0 ||
            preview.unmappedSubUnits.length > 0 ||
            preview.unmappedCategories.length > 0 ||
            preview.unmappedPics.length > 0) && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs text-amber-900">
              <div className="font-semibold text-sm text-amber-950 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Terdeteksi Nilai Master Data yang Tidak Cocok:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                {preview.unmappedProjects.length > 0 && (
                  <div>
                    <span className="font-semibold">Proyek: </span>
                    {preview.unmappedProjects.join(", ")}
                  </div>
                )}
                {preview.unmappedSubUnits.length > 0 && (
                  <div>
                    <span className="font-semibold">Sub-Unit: </span>
                    {preview.unmappedSubUnits.join(", ")}
                  </div>
                )}
                {preview.unmappedCategories.length > 0 && (
                  <div>
                    <span className="font-semibold">Kategori: </span>
                    {preview.unmappedCategories.join(", ")}
                  </div>
                )}
                {preview.unmappedPics.length > 0 && (
                  <div>
                    <span className="font-semibold">PIC: </span>
                    {preview.unmappedPics.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Issues Table */}
          {preview.issues.length > 0 && (
            <div className="bg-white border border-red-200 rounded-lg overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-red-50/60 border-b border-red-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-red-900">
                  Daftar Masalah Validasi ({preview.issues.length} Temuan)
                </div>
                <div className="text-xs text-red-700">
                  Baris dengan masalah akan dilewati atau diperbaiki terlebih dahulu
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 w-16">Baris</th>
                      <th className="px-4 py-2 w-28">Kolom/Field</th>
                      <th className="px-4 py-2 w-36">Nilai Input</th>
                      <th className="px-4 py-2">Deskripsi Masalah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.issues.map((iss, idx) => (
                      <tr key={idx} className="hover:bg-red-50/30">
                        <td className="px-4 py-2 font-mono font-medium text-slate-800">#{iss.row}</td>
                        <td className="px-4 py-2 font-medium text-slate-900">{iss.field}</td>
                        <td className="px-4 py-2 font-mono text-slate-600 truncate max-w-xs">{iss.value || "(kosong)"}</td>
                        <td className="px-4 py-2 text-red-700">{iss.problem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Batch Information Form */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Informasi Batch Data ACC
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Batch <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal ACC <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={accDate}
                  onChange={(e) => setAccDate(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Atasan Peng-ACC <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={approvedByName}
                  onChange={(e) => setApprovedByName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Batch
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan batch data ACC"
                  className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Rows Preview Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Preview Data ({preview.rows.length} Baris Terbaca)
              </div>
              <div className="text-xs text-slate-500">
                Menampilkan status validasi tiap baris
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-12 text-center">No</th>
                    <th className="px-3 py-2 w-20 text-center">Status</th>
                    <th className="px-3 py-2 w-24">No Kas</th>
                    <th className="px-3 py-2 w-28">Proyek</th>
                    <th className="px-3 py-2 w-24">Sub Unit</th>
                    <th className="px-3 py-2 w-28">Kategori</th>
                    <th className="px-3 py-2 w-24">PIC</th>
                    <th className="px-3 py-2">Uraian</th>
                    <th className="px-3 py-2 text-right w-28">Nominal ACC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={row.isValid ? "hover:bg-slate-50" : "bg-red-50/40 hover:bg-red-50/60"}
                    >
                      <td className="px-3 py-2 text-center font-mono text-slate-500">#{row.rowNumber}</td>
                      <td className="px-3 py-2 text-center">
                        {row.isValid ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            VALID
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                            GAGAL
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-800">
                        {row.resolvedNoKas || row.rawNoKas || <span className="text-slate-400 italic">Auto</span>}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 truncate max-w-[120px]">
                        {row.resolvedProjectName || row.rawProject}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[100px]">
                        {row.resolvedSubUnitName || row.rawSubUnit || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">
                        {row.resolvedCategoryName || row.rawCategory}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[100px]">
                        {row.resolvedPicName || row.rawPic}
                      </td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-xs">{row.rawDescription}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">
                        {formatCurrency(row.rawApprovedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-600">
              {preview.validRows > 0 ? (
                <span>
                  Siap mengimpor <strong>{preview.validRows}</strong> baris valid (Total:{" "}
                  <strong>{formatCurrency(preview.totalApprovedAmount)}</strong>).
                </span>
              ) : (
                <span className="text-red-600 font-semibold">
                  Semua baris data bermasalah. Perbaiki file sebelum melanjutkan.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setPreview(null)}
                disabled={isImporting}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm"
              >
                Ganti File
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={preview.validRows === 0 || isImporting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isImporting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menyimpan ke Database...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Konfirmasi & Impor ({preview.validRows} Baris)
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
