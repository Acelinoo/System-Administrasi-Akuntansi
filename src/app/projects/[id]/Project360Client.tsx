"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatRupiah,
  formatDate,
  accStatusLabel,
  txStatusLabel,
} from "@/lib/utils/format";
import {
  ProjectIcon,
  DocumentIcon,
  InflowIcon,
  DisbursementIcon,
  JournalIcon,
  PlusIcon,
  PicIcon,
} from "../../components/Icons";
import {
  createProjectBudgetAction,
  addBudgetItemAction,
  deleteBudgetItemAction,
  createProjectTerminAction,
  recordTerminPaymentAction,
  createProjectProgressLogAction,
  createExpenseItemDetailAction,
  createVendorContractAction,
  updateProjectContractDetailsAction,
} from "../../actions/project-360.actions";

interface Project360ClientProps {
  data: any;
  lookups: {
    cashAccounts: Array<{ id: string; accountName: string; accountCode: string }>;
    vendors: Array<{ id: string; name: string; code: string | null; type: string }>;
    categories: Array<{ id: string; name: string; code: string }>;
  };
}

export default function Project360Client({ data, lookups }: Project360ClientProps) {
  const router = useRouter();
  const { project, metrics, categoryCostBreakdown, budgets, termins, progressLogs, vendorContracts, fundInflows, accItems, journalLines, allItemDetails } = data;

  const [activeTab, setActiveTab] = useState<"cost" | "rap" | "termin" | "expenses" | "vendors" | "progress" | "journals">("cost");

  // Modals state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBudgetItemModal, setShowBudgetItemModal] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [showTerminModal, setShowTerminModal] = useState(false);
  const [showPayTerminModal, setShowPayTerminModal] = useState(false);
  const [selectedTermin, setSelectedTermin] = useState<any>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedAccItem, setSelectedAccItem] = useState<any>(null);
  const [showVendorContractModal, setShowVendorContractModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Handlers
  const handleEditProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await updateProjectContractDetailsAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowEditProjectModal(false);
      router.refresh();
    }
  };

  const handleCreateBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await createProjectBudgetAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowBudgetModal(false);
      router.refresh();
    }
  };

  const handleAddBudgetItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await addBudgetItemAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowBudgetItemModal(false);
      router.refresh();
    }
  };

  const handleDeleteBudgetItem = async (itemId: string) => {
    if (!confirm("Hapus pos anggaran ini?")) return;
    await deleteBudgetItemAction(itemId, project.id);
    router.refresh();
  };

  const handleCreateTermin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await createProjectTerminAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowTerminModal(false);
      router.refresh();
    }
  };

  const handlePayTermin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await recordTerminPaymentAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowPayTerminModal(false);
      setSelectedTermin(null);
      router.refresh();
    }
  };

  const handleCreateProgress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await createProjectProgressLogAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowProgressModal(false);
      router.refresh();
    }
  };

  const handleCreateMaterialDetail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await createExpenseItemDetailAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowMaterialModal(false);
      setSelectedAccItem(null);
      router.refresh();
    }
  };

  const handleCreateVendorContract = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await createVendorContractAction(formData);
    setLoading(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setShowVendorContractModal(false);
      router.refresh();
    }
  };

  return (
    <>
      {/* 1. PROJECT HEADER */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-mono text-primary text-xl tracking-tight">
              {project.code}
            </span>
            <span className="text-xl font-semibold text-slate-900">{project.name}</span>
            <span
              className="text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{
                background: project.projectType === "KONSULTAN" ? "#fef3c7" : "#e0e7ff",
                color: project.projectType === "KONSULTAN" ? "#92400e" : "#3730a3",
              }}
            >
              {project.projectType || "KONTRAKTOR"}
            </span>
            {project.confirmationStatus === "REQUIRES_BUSINESS_CONFIRMATION" && (
              <span
                className="text-[10px] px-2 py-0.5 rounded font-bold uppercase"
                style={{ background: "#fee2e2", color: "#991b1b" }}
              >
                Butuh Konfirmasi
              </span>
            )}
          </div>
          <div className="page-header-subtitle flex items-center gap-4 mt-1">
            <span>
              <strong>Owner/Klien:</strong> {project.clientName || <em className="text-muted">Belum ditentukan</em>}
            </span>
            <span>•</span>
            <span>
              <strong>Periode:</strong>{" "}
              {project.targetStartDate ? formatDate(project.targetStartDate) : "-"} s.d.{" "}
              {project.targetEndDate ? formatDate(project.targetEndDate) : "-"}
            </span>
            {project.subUnits.length > 0 && (
              <>
                <span>•</span>
                <span>
                  <strong>Sub-Unit:</strong> {project.subUnits.map((s: any) => s.code).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setErrorMsg(null);
              setShowEditProjectModal(true);
            }}
            className="btn btn-secondary btn-sm"
          >
            Edit Kontrak & Info
          </button>
          <Link href="/reports/projects" className="btn btn-secondary btn-sm">
            ← Kembali ke Monitoring
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* 2. PROMINENT 8-CARD FINANCIAL & COST CONTROL HERO */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          {/* Card 1: Nilai Kontrak */}
          <div className="stat-card" style={{ borderLeft: "4px solid var(--blue-600)" }}>
            <div>
              <div className="stat-label">Nilai Kontrak Induk</div>
              <div className="stat-value primary">
                {metrics.contractValue !== null ? formatRupiah(metrics.contractValue) : "-"}
              </div>
            </div>
            <div className="stat-sub">Plafon penerimaan dari pemilik proyek</div>
          </div>

          {/* Card 2: Anggaran RAP / RAB */}
          <div className="stat-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
            <div>
              <div className="stat-label">Anggaran RAP / RAB</div>
              <div className="stat-value" style={{ color: "#7c3aed" }}>
                {metrics.totalRapBudget > 0 ? formatRupiah(metrics.totalRapBudget) : "-"}
              </div>
            </div>
            <div className="stat-sub">
              {metrics.totalRapBudget > 0
                ? `${budgets.length} revisi pagu anggaran`
                : "Belum disusun"}
            </div>
          </div>

          {/* Card 3: Penerimaan Aktual (Inflow) */}
          <div className="stat-card" style={{ borderLeft: "4px solid var(--color-success)" }}>
            <div>
              <div className="stat-label">Penerimaan Aktual (Masuk)</div>
              <div className="stat-value positive">{formatRupiah(metrics.totalPostedInflow)}</div>
            </div>
            <div className="stat-sub">
              {metrics.receiptProgressPct !== null
                ? `${metrics.receiptProgressPct.toFixed(1)}% dari nilai kontrak`
                : "Kas riil diterima (POSTED)"}
            </div>
          </div>

          {/* Card 4: Biaya Aktual (Disbursed) */}
          <div className="stat-card" style={{ borderLeft: "4px solid var(--slate-700)" }}>
            <div>
              <div className="stat-label">Biaya Aktual (Keluar)</div>
              <div className="stat-value">{formatRupiah(metrics.totalPostedExpense)}</div>
            </div>
            <div className="stat-sub">
              Alokasi sah ACC: {formatRupiah(metrics.totalAccApproved)}
            </div>
          </div>

          {/* Card 5: Sisa Nilai Kontrak */}
          <div className="stat-card">
            <div>
              <div className="stat-label">Sisa Nilai Kontrak</div>
              <div className="stat-value">
                {metrics.remainingContractValue !== null
                  ? formatRupiah(metrics.remainingContractValue)
                  : "-"}
              </div>
            </div>
            <div className="stat-sub">Nilai Kontrak − Penerimaan Masuk</div>
          </div>

          {/* Card 6: Saldo Penerimaan Bersih */}
          <div className="stat-card">
            <div>
              <div className="stat-label">Saldo Penerimaan Bersih</div>
              <div
                className={`stat-value ${
                  metrics.netInflowBalance >= 0 ? "positive" : "warning"
                }`}
              >
                {formatRupiah(metrics.netInflowBalance)}
              </div>
            </div>
            <div className="stat-sub">Penerimaan Masuk − Biaya Keluar</div>
          </div>

          {/* Card 7: Sisa Anggaran RAP */}
          <div className="stat-card">
            <div>
              <div className="stat-label">Sisa Anggaran RAP</div>
              <div
                className={`stat-value ${
                  metrics.remainingRapBudget !== null && metrics.remainingRapBudget >= 0
                    ? "positive"
                    : metrics.remainingRapBudget !== null
                    ? "warning"
                    : ""
                }`}
              >
                {metrics.remainingRapBudget !== null
                  ? formatRupiah(metrics.remainingRapBudget)
                  : "-"}
              </div>
            </div>
            <div className="stat-sub">Pagu RAP − Biaya Aktual Keluar</div>
          </div>

          {/* Card 8: Komparasi Progres */}
          <div
            className="stat-card"
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
            }}
          >
            <div>
              <div className="stat-label">Komparasi Progres Proyek</div>
              <div className="flex items-center gap-3 mt-1">
                <div>
                  <span className="text-[11px] text-muted block">Penerimaan:</span>
                  <span className="font-bold text-sm text-primary">
                    {metrics.receiptProgressPct !== null
                      ? `${metrics.receiptProgressPct.toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <div style={{ height: "24px", width: "1px", background: "#cbd5e1" }} />
                <div>
                  <span className="text-[11px] text-muted block">Fisik (Sipil):</span>
                  {metrics.physicalProgressPct !== null ? (
                    <span className="font-bold text-sm" style={{ color: "var(--color-success)" }}>
                      {metrics.physicalProgressPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                      Belum tersedia
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="stat-sub">
              {metrics.physicalProgressPct !== null && metrics.receiptProgressPct !== null
                ? `Varian: ${(metrics.receiptProgressPct - metrics.physicalProgressPct).toFixed(1)}% (Cash vs Fisik)`
                : "Data fisik independen dari bagian sipil"}
            </div>
          </div>
        </div>

        {/* 3. WORKSPACE TAB NAVIGATION */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            borderBottom: "1px solid var(--slate-200)",
            marginBottom: "20px",
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => setActiveTab("cost")}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderBottom: activeTab === "cost" ? "2px solid var(--blue-600)" : "2px solid transparent",
              color: activeTab === "cost" ? "var(--blue-600)" : "var(--slate-600)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            📊 Rekap Biaya & Kontrol ({categoryCostBreakdown.length} Pos)
          </button>
          <button
            onClick={() => setActiveTab("rap")}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderBottom: activeTab === "rap" ? "2px solid var(--blue-600)" : "2px solid transparent",
              color: activeTab === "rap" ? "var(--blue-600)" : "var(--slate-600)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            📐 Anggaran RAP/RAB ({budgets.length})
          </button>
          <button
            onClick={() => setActiveTab("termin")}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderBottom: activeTab === "termin" ? "2px solid var(--blue-600)" : "2px solid transparent",
              color: activeTab === "termin" ? "var(--blue-600)" : "var(--slate-600)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            💵 Termin & Kas Masuk ({termins.length})
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderBottom: activeTab === "expenses" ? "2px solid var(--blue-600)" : "2px solid transparent",
              color: activeTab === "expenses" ? "var(--blue-600)" : "var(--slate-600)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            📝 Voucher ACC & Material ({accItems.length})
          </button>
          <button
            onClick={() => setActiveTab("vendors")}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderBottom: activeTab === "vendors" ? "2px solid var(--blue-600)" : "2px solid transparent",
              color: activeTab === "vendors" ? "var(--blue-600)" : "var(--slate-600)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            👷 Vendor & Subkon ({vendorContracts.length})
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderBottom: activeTab === "progress" ? "2px solid var(--blue-600)" : "2px solid transparent",
              color: activeTab === "progress" ? "var(--blue-600)" : "var(--slate-600)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            🏗️ Progres Fisik Sipil ({progressLogs.length})
          </button>
          <button
            onClick={() => setActiveTab("journals")}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderBottom: activeTab === "journals" ? "2px solid var(--blue-600)" : "2px solid transparent",
              color: activeTab === "journals" ? "var(--blue-600)" : "var(--slate-600)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
            }}
          >
            📖 Jurnal Proyek ({journalLines.length})
          </button>
        </div>

        {/* 4. TAB CONTENTS */}

        {/* TAB 1: REKAP BIAYA & KONTROL ANGGARAN */}
        {activeTab === "cost" && (
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div>
                <h2>Pengendalian Biaya per Kategori Operasional</h2>
                <div className="text-xs text-muted">
                  Perbandingan antara alokasi persetujuan ACC, realisasi pencairan keluar, dan pagu RAP per pos biaya
                </div>
              </div>
            </div>
            <div className="card-body-flush">
              {categoryCostBreakdown.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">Belum ada transaksi biaya untuk proyek ini.</div>
                  <div className="empty-state-desc">
                    Biaya akan otomatis muncul saat staf mencatatkan pengajuan ACC yang diatribusikan ke proyek ini.
                  </div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kategori Biaya</th>
                      <th className="text-right">Pagu RAP</th>
                      <th className="text-right">Disetujui (ACC)</th>
                      <th className="text-right">Realisasi (Keluar)</th>
                      <th className="text-right">Sisa Outstanding</th>
                      <th className="text-right">Sisa RAP</th>
                      <th className="text-center">Status Kontrol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryCostBreakdown.map((cat: any) => {
                      const pct =
                        cat.approvedAmount > 0
                          ? ((cat.realizedAmount / cat.approvedAmount) * 100).toFixed(1)
                          : "0.0";

                      return (
                        <tr key={cat.categoryId}>
                          <td>
                            <span className="font-semibold text-slate-800">{cat.categoryCode}</span> —{" "}
                            {cat.categoryName}
                          </td>
                          <td className="col-num text-sm">
                            {cat.budgetAmount > 0 ? formatRupiah(cat.budgetAmount) : "-"}
                          </td>
                          <td className="col-num text-sm font-semibold">{formatRupiah(cat.approvedAmount)}</td>
                          <td className="col-num text-sm font-semibold text-primary">
                            {formatRupiah(cat.realizedAmount)}
                          </td>
                          <td className="col-num text-sm font-medium" style={{ color: cat.outstandingAmount > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                            {formatRupiah(cat.outstandingAmount)}
                          </td>
                          <td className="col-num text-sm">
                            {cat.budgetAmount > 0 ? (
                              <span style={{ color: cat.variance >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                                {formatRupiah(cat.variance)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="text-center">
                            {cat.status === "EXCEEDED" ? (
                              <span className="status status-danger" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                                OVER BUDGET
                              </span>
                            ) : cat.status === "WARNING" ? (
                              <span className="status status-warning" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                                MENDEKATI RAP
                              </span>
                            ) : (
                              <span className="status status-info" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                                {pct}% Cair
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                      <td>TOTAL KESELURUHAN:</td>
                      <td className="col-num">
                        {metrics.totalRapBudget > 0 ? formatRupiah(metrics.totalRapBudget) : "-"}
                      </td>
                      <td className="col-num">{formatRupiah(metrics.totalAccApproved)}</td>
                      <td className="col-num text-primary">{formatRupiah(metrics.totalPostedExpense)}</td>
                      <td className="col-num" style={{ color: "var(--color-warning)" }}>
                        {formatRupiah(metrics.totalAccOutstanding)}
                      </td>
                      <td className="col-num">
                        {metrics.remainingRapBudget !== null ? formatRupiah(metrics.remainingRapBudget) : "-"}
                      </td>
                      <td className="text-center">
                        {metrics.costVarianceStatus === "OVERBUDGET" && (
                          <span className="status status-danger">PERIKSA VARIANCE</span>
                        )}
                        {metrics.costVarianceStatus === "HEALTHY" && (
                          <span className="status status-success">AMAN</span>
                        )}
                        {metrics.costVarianceStatus === "WARNING" && (
                          <span className="status status-warning">PERINGATAN</span>
                        )}
                        {metrics.costVarianceStatus === "NO_BUDGET" && (
                          <span className="text-muted text-xs">Tanpa RAP</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: RAP / RAB (RENCANA ANGGARAN PELAKSANAAN) */}
        {activeTab === "rap" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">Rencana Anggaran Pelaksanaan (RAP / RAB)</h3>
                <div className="text-xs text-muted">
                  Monitoring pagu anggaran pekerjaan dan alat kontrol pengeluaran lapangan
                </div>
              </div>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowBudgetModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon size={14} />
                <span>Buat Versi RAP Baru</span>
              </button>
            </div>

            {budgets.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-title">Belum ada RAP / RAB untuk proyek ini.</div>
                  <div className="empty-state-desc">
                    Silakan susun rencana anggaran pelaksanaan agar sistem dapat memberikan monitoring varian biaya dan peringatan over-budget.
                  </div>
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setShowBudgetModal(true);
                    }}
                    className="btn btn-primary btn-sm mt-3"
                  >
                    Buat RAP Sekarang
                  </button>
                </div>
              </div>
            ) : (
              budgets.map((b: any) => (
                <div className="card mb-6" key={b.id}>
                  <div className="card-header flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900 text-base">{b.title}</span>
                        <span className="status status-info">{formatRupiah(Number(b.totalBudget))}</span>
                      </div>
                      {b.notes && <div className="text-xs text-muted mt-0.5">{b.notes}</div>}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedBudgetId(b.id);
                        setErrorMsg(null);
                        setShowBudgetItemModal(true);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <PlusIcon size={13} />
                      <span>Tambah Item Pekerjaan</span>
                    </button>
                  </div>
                  <div className="card-body-flush">
                    {b.items.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted">
                        Belum ada item pekerjaan dalam RAP ini. Klik "Tambah Item Pekerjaan" di atas.
                      </div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: 80 }}>Kode</th>
                            <th>Uraian Pekerjaan / Material</th>
                            <th>Kategori</th>
                            <th className="text-right">Volume</th>
                            <th>Satuan</th>
                            <th className="text-right">Harga Satuan (Rp)</th>
                            <th className="text-right">Total Anggaran (Rp)</th>
                            <th className="text-center" style={{ width: 80 }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.items.map((it: any) => (
                            <tr key={it.id}>
                              <td className="col-mono text-xs">{it.itemCode || "-"}</td>
                              <td className="font-medium text-slate-900">{it.description}</td>
                              <td className="text-xs">{it.category || "-"}</td>
                              <td className="col-num text-sm">{Number(it.volume).toLocaleString("id-ID")}</td>
                              <td className="text-xs text-muted">{it.unit}</td>
                              <td className="col-num text-sm">{formatRupiah(Number(it.unitPrice))}</td>
                              <td className="col-num text-sm font-semibold">{formatRupiah(Number(it.totalAmount))}</td>
                              <td className="text-center">
                                <button
                                  onClick={() => handleDeleteBudgetItem(it.id)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                            <td colSpan={6} className="text-right">TOTAL PAGU RAP:</td>
                            <td className="col-num text-primary">{formatRupiah(Number(b.totalBudget))}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: TERMIN & PENERIMAAN DANA */}
        {activeTab === "termin" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">Jadwal Termin & Riwayat Penerimaan Kas</h3>
                <div className="text-xs text-muted">
                  Membedakan rencana termin, penagihan invoice, dan kas masuk riil yang diposting
                </div>
              </div>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowTerminModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon size={14} />
                <span>Tambah Rencana Termin</span>
              </button>
            </div>

            {/* Termin Schedule Table */}
            <div className="card mb-6">
              <div className="card-header">
                <h2>Rencana & Realisasi Termin Penagihan</h2>
              </div>
              <div className="card-body-flush">
                {termins.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-title">Belum ada termin penagihan yang dijadwalkan.</div>
                    <div className="empty-state-desc">
                      Catat jadwal termin penagihan klien untuk memantau sisa piutang dan penerimaan kas masuk.
                    </div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Termin #</th>
                        <th>Keterangan Penagihan</th>
                        <th className="text-right">Rencana Nominal</th>
                        <th>No. Invoice</th>
                        <th>Tgl Invoice</th>
                        <th className="text-center">Status</th>
                        <th className="text-right">Diterima Riil</th>
                        <th>Tgl Penerimaan</th>
                        <th className="text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {termins.map((t: any) => (
                        <tr key={t.id}>
                          <td className="col-mono font-bold text-center">{t.terminNumber}</td>
                          <td className="font-medium text-slate-900">{t.name}</td>
                          <td className="col-num font-semibold">{formatRupiah(Number(t.plannedAmount))}</td>
                          <td className="col-mono text-xs">{t.invoiceNumber || "-"}</td>
                          <td className="text-xs">{t.invoiceDate ? formatDate(t.invoiceDate) : "-"}</td>
                          <td className="text-center">
                            {t.status === "RECEIVED" ? (
                              <span className="status status-success">DITERIMA (POSTED)</span>
                            ) : t.status === "INVOICED" ? (
                              <span className="status status-warning">DITAGIHKAN</span>
                            ) : (
                              <span className="status status-neutral">RENCANA</span>
                            )}
                          </td>
                          <td className="col-num text-sm text-primary font-bold">
                            {t.receivedAmount ? formatRupiah(Number(t.receivedAmount)) : "-"}
                          </td>
                          <td className="text-xs">{t.receivedDate ? formatDate(t.receivedDate) : "-"}</td>
                          <td className="text-center">
                            {t.status !== "RECEIVED" ? (
                              <button
                                onClick={() => {
                                  setSelectedTermin(t);
                                  setErrorMsg(null);
                                  setShowPayTerminModal(true);
                                }}
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                              >
                                Catat Dana Masuk
                              </button>
                            ) : (
                              <span className="text-xs text-muted">Lunas ✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Riwayat Fund Inflow Teratribusi */}
            <div className="card">
              <div className="card-header">
                <h2>Riwayat Penerimaan Kas Riil (Fund Inflow Teratribusi Proyek)</h2>
              </div>
              <div className="card-body-flush">
                {fundInflows.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">
                    Belum ada kas masuk yang diatribusikan ke proyek ini.
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No. Bukti Kas Masuk</th>
                        <th>Tanggal Terima</th>
                        <th>Rekening Penerima</th>
                        <th>Sumber / Keterangan</th>
                        <th className="text-right">Nominal Masuk</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fundInflows.map((inf: any) => (
                        <tr key={inf.id}>
                          <td className="col-mono font-medium">{inf.inflowNumber}</td>
                          <td className="text-sm">{formatDate(inf.inflowDate)}</td>
                          <td className="text-sm">
                            {inf.destinationAccount.accountName} ({inf.destinationAccount.accountCode})
                          </td>
                          <td className="text-sm">{inf.sourceInfo}</td>
                          <td className="col-num font-semibold text-primary">{formatRupiah(Number(inf.amount))}</td>
                          <td className="text-center">
                            <span className="status status-success">POSTED</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                        <td colSpan={4} className="text-right">TOTAL PENERIMAAN PROYEK (POSTED):</td>
                        <td className="col-num text-primary">{formatRupiah(metrics.totalPostedInflow)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VOUCHER ACC & MATERIAL DETAILS */}
        {activeTab === "expenses" && (
          <div>
            {/* ACC Vouchers List */}
            <div className="card mb-6">
              <div className="card-header">
                <h2>Daftar Pengajuan ACC Proyek ({accItems.length} Item)</h2>
              </div>
              <div className="card-body-flush">
                {accItems.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-title">Belum ada pengajuan ACC untuk proyek ini.</div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No Kas</th>
                        <th>Tanggal</th>
                        <th>Kategori</th>
                        <th>PIC</th>
                        <th>Uraian Kebutuhan</th>
                        <th className="text-right">ACC Disetujui</th>
                        <th className="text-right">Realisasi</th>
                        <th className="text-right">Sisa Outstanding</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Rincian Barang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accItems.map((item: any) => {
                        const statusInfo = accStatusLabel(item.status);
                        const itemRealized = item.disbursementItems.reduce(
                          (s: number, di: any) => s + Number(di.realizedAmount),
                          0
                        );
                        const itemOutstanding = Math.max(0, Number(item.approvedAmount) - itemRealized);

                        return (
                          <tr key={item.id}>
                            <td className="col-mono font-medium">
                              <Link href={`/acc/${item.id}`} className="text-primary hover:underline">
                                {item.noKas}
                              </Link>
                            </td>
                            <td className="text-sm">{formatDate(item.batch.accDate)}</td>
                            <td className="text-sm font-medium">{item.category.name}</td>
                            <td className="text-sm">{item.pic.name}</td>
                            <td className="text-sm" style={{ maxWidth: 220 }}>{item.description}</td>
                            <td className="col-num font-semibold">{formatRupiah(Number(item.approvedAmount))}</td>
                            <td className="col-num text-primary font-semibold">{formatRupiah(itemRealized)}</td>
                            <td className="col-num font-medium" style={{ color: itemOutstanding > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                              {formatRupiah(itemOutstanding)}
                            </td>
                            <td className="text-center">
                              <span className={`status ${statusInfo.className}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="text-center">
                              <button
                                onClick={() => {
                                  setSelectedAccItem(item);
                                  setErrorMsg(null);
                                  setShowMaterialModal(true);
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "0.72rem", padding: "2px 6px" }}
                              >
                                + Rincian ({item.itemDetails.length})
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Rincian Material / Barang Terdaftar */}
            <div className="card">
              <div className="card-header">
                <h2>Rincian Barang & Material Pembelian Proyek ({allItemDetails.length} Item Rincian)</h2>
              </div>
              <div className="card-body-flush">
                {allItemDetails.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">
                    Belum ada rincian material (kuantitas, satuan, harga per unit, toko) yang dicatat. Klik "+ Rincian" pada tabel di atas untuk menambah rincian barang.
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No Kas ACC</th>
                        <th>Nama Barang / Material</th>
                        <th className="text-right">Qty</th>
                        <th>Satuan</th>
                        <th className="text-right">Harga Satuan</th>
                        <th className="text-right">Total Harga</th>
                        <th>Vendor / Toko</th>
                        <th>No. Bukti / Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allItemDetails.map((det: any) => (
                        <tr key={det.id}>
                          <td className="col-mono text-xs">{det.accItemNoKas}</td>
                          <td className="font-medium text-slate-900">{det.itemName}</td>
                          <td className="col-num text-sm">{Number(det.quantity).toLocaleString("id-ID")}</td>
                          <td className="text-xs text-muted">{det.unit}</td>
                          <td className="col-num text-sm">{formatRupiah(Number(det.unitPrice))}</td>
                          <td className="col-num text-sm font-semibold">{formatRupiah(Number(det.totalPrice))}</td>
                          <td className="text-sm">
                            {det.vendor ? `${det.vendor.name}` : "-"}
                          </td>
                          <td className="text-xs col-mono">{det.referenceNo || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: VENDOR & SUBKONTRAKTOR */}
        {activeTab === "vendors" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">Kontrak Vendor & Subkontraktor Lapangan</h3>
                <div className="text-xs text-muted">
                  Monitoring SPK subkon, toko supplier, dan komitmen kewajiban pihak ketiga
                </div>
              </div>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowVendorContractModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon size={14} />
                <span>Tambah SPK / Kontrak Vendor</span>
              </button>
            </div>

            <div className="card">
              <div className="card-body-flush">
                {vendorContracts.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-title">Belum ada kontrak vendor atau subkon terdaftar.</div>
                    <div className="empty-state-desc">
                      Catat nomor SPK/kontrak dengan mandor borongan atau supplier toko untuk memantau komitmen biaya.
                    </div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No. SPK / Kontrak</th>
                        <th>Judul Kontrak</th>
                        <th>Nama Vendor / Subkon</th>
                        <th>Tipe</th>
                        <th className="text-right">Nilai Kontrak (Rp)</th>
                        <th>Periode Pelaksanaan</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorContracts.map((vc: any) => (
                        <tr key={vc.id}>
                          <td className="col-mono font-medium">{vc.contractNumber}</td>
                          <td className="font-semibold text-slate-900">{vc.title}</td>
                          <td className="text-sm">{vc.vendor.name}</td>
                          <td>
                            <span className="status status-neutral" style={{ fontSize: "0.72rem" }}>
                              {vc.vendor.type}
                            </span>
                          </td>
                          <td className="col-num font-bold text-primary">{formatRupiah(Number(vc.contractValue))}</td>
                          <td className="text-xs">
                            {vc.startDate ? formatDate(vc.startDate) : "-"} s.d.{" "}
                            {vc.endDate ? formatDate(vc.endDate) : "-"}
                          </td>
                          <td className="text-center">
                            <span className="status status-success">{vc.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PROGRES FISIK SIPIL */}
        {activeTab === "progress" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">Log Opname Progres Fisik Lapangan</h3>
                <div className="text-xs text-muted">
                  Data progres fisik yang diinput secara berkala dari pengawasan bagian sipil
                </div>
              </div>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowProgressModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon size={14} />
                <span>Catat Opname Fisik Baru</span>
              </button>
            </div>

            {/* Current Status Box */}
            <div
              className="card mb-6"
              style={{
                background: "linear-gradient(to right, #eff6ff, #f8fafc)",
                borderColor: "#bfdbfe",
              }}
            >
              <div className="card-body flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-700 font-bold uppercase tracking-wider mb-1">
                    Capaian Progres Fisik Terkini (Bagian Sipil)
                  </div>
                  {progressLogs.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-bold text-blue-900">
                        {Number(progressLogs[0].physicalProgressPct).toFixed(1)}%
                      </span>
                      <div>
                        <div className="text-xs text-slate-700 font-medium">
                          Opname per {formatDate(progressLogs[0].logDate)} oleh {progressLogs[0].sourceInfo || "Bagian Sipil"}
                        </div>
                        {progressLogs[0].volumeDescription && (
                          <div className="text-xs text-muted mt-0.5">
                            Capaian: {progressLogs[0].volumeDescription}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-600">
                      Status: <em>Belum tersedia data progres fisik</em>
                    </div>
                  )}
                </div>
                {metrics.receiptProgressPct !== null && progressLogs.length > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-muted">Bandingkan dengan Penerimaan Kas:</div>
                    <div className="text-xl font-bold text-slate-800">
                      {metrics.receiptProgressPct.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-muted">
                      {metrics.receiptProgressPct >= Number(progressLogs[0].physicalProgressPct)
                        ? "Penerimaan mendahului progres fisik (Arus kas sehat)"
                        : "Progres fisik mendahului penerimaan termin"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* History Table */}
            <div className="card">
              <div className="card-header">
                <h2>Riwayat Log Opname Fisik Lapangan</h2>
              </div>
              <div className="card-body-flush">
                {progressLogs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-title">Belum ada catatan opname fisik.</div>
                    <div className="empty-state-desc">
                      Bagian sipil dapat mencatat persentase progres fisik mingguan di sini.
                    </div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tanggal Opname</th>
                        <th className="text-center">Progres Fisik</th>
                        <th>Capaian Volume / Pekerjaan</th>
                        <th>Sumber Informasi / Pelapor</th>
                        <th>Catatan Khusus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressLogs.map((log: any) => (
                        <tr key={log.id}>
                          <td className="text-sm font-medium">{formatDate(log.logDate)}</td>
                          <td className="text-center">
                            <span className="status status-success font-bold" style={{ fontSize: "0.8rem", padding: "2px 8px" }}>
                              {Number(log.physicalProgressPct).toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-sm font-medium text-slate-900">{log.volumeDescription || "-"}</td>
                          <td className="text-xs text-muted">{log.sourceInfo || "Bagian Sipil"}</td>
                          <td className="text-xs text-muted">{log.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: JURNAL PROYEK */}
        {activeTab === "journals" && (
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div>
                <h2>Buku Jurnal Proyek (Single-Entry Projection)</h2>
                <div className="text-xs text-muted">
                  Buku jurnal pembukuan double-entry yang diatribusikan ke proyek ini secara otomatis
                </div>
              </div>
              <span className="text-xs text-muted font-medium">{journalLines.length} baris jurnal aktif</span>
            </div>
            <div className="card-body-flush">
              {journalLines.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">Belum ada jurnal pembukuan untuk proyek ini.</div>
                  <div className="empty-state-desc">
                    Jurnal akan otomatis terposting saat transaksi pengeluaran/penerimaan berstatus POSTED diproses.
                  </div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>No. Jurnal</th>
                      <th>Kode Akun</th>
                      <th>Nama Akun COA</th>
                      <th>Keterangan / Memo</th>
                      <th className="text-right">Debit (Rp)</th>
                      <th className="text-right">Kredit (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalLines.map((line: any) => (
                      <tr key={line.id}>
                        <td className="text-sm">{formatDate(line.journal.entryDate)}</td>
                        <td className="col-mono text-xs font-medium">{line.journal.journalNumber}</td>
                        <td className="col-mono text-xs">{line.coa.accountCode}</td>
                        <td className="text-sm font-medium text-slate-900">{line.coa.accountName}</td>
                        <td className="text-sm" style={{ maxWidth: 260 }}>
                          {line.memo || line.journal.description}
                        </td>
                        <td className="col-num font-medium">
                          {Number(line.debit) > 0 ? formatRupiah(Number(line.debit)) : "-"}
                        </td>
                        <td className="col-num font-medium">
                          {Number(line.credit) > 0 ? formatRupiah(Number(line.credit)) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* 1. Modal Edit Proyek & Kontrak */}
      {showEditProjectModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2>Edit Kontrak & Klasifikasi Proyek</h2>
              <button onClick={() => setShowEditProjectModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleEditProject}>
              <input type="hidden" name="id" value={project.id} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="form-group mb-3">
                  <label className="form-label">Tipe / Klasifikasi Proyek</label>
                  <select name="projectType" defaultValue={project.projectType || "KONTRAKTOR"} className="form-control">
                    <option value="KONTRAKTOR">Proyek Kontraktor (Konstruksi / Sipil)</option>
                    <option value="KONSULTAN">Proyek Konsultan (Perencanaan / Supervisi)</option>
                    <option value="INTERNAL">Proyek / Operasional Internal</option>
                  </select>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Nama Pemilik / Klien (Owner)</label>
                  <input
                    type="text"
                    name="clientName"
                    defaultValue={project.clientName || ""}
                    placeholder="Contoh: PT Sumber Berkah / Ibu Ani"
                    className="form-control"
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Nilai Kontrak Induk (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    name="contractValue"
                    defaultValue={project.contractValue ? Number(project.contractValue) : ""}
                    placeholder="Contoh: 5200000000"
                    className="form-control"
                  />
                </div>
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Target Mulai</label>
                    <input
                      type="date"
                      name="targetStartDate"
                      defaultValue={project.targetStartDate ? new Date(project.targetStartDate).toISOString().slice(0, 10) : ""}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Selesai</label>
                    <input
                      type="date"
                      name="targetEndDate"
                      defaultValue={project.targetEndDate ? new Date(project.targetEndDate).toISOString().slice(0, 10) : ""}
                      className="form-control"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditProjectModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Buat RAP Baru */}
      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Buat Versi Anggaran RAP / RAB Baru</h2>
              <button onClick={() => setShowBudgetModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleCreateBudget}>
              <input type="hidden" name="projectId" value={project.id} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="form-group mb-3">
                  <label className="form-label">Judul Anggaran / Revisi</label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Contoh: RAP Pelaksanaan Awal 2026 / Revisi 1"
                    className="form-control"
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Catatan RAP (Opsional)</label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Catatan persetujuan anggaran internal..."
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowBudgetModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Memproses..." : "Buat RAP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Tambah Item RAP */}
      {showBudgetItemModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2>Tambah Pos Item Anggaran RAP</h2>
              <button onClick={() => setShowBudgetItemModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleAddBudgetItem}>
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="budgetId" value={selectedBudgetId} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Kode Item (Opsional)</label>
                    <input type="text" name="itemCode" placeholder="Contoh: A.1 / SIPIL.01" className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kategori Pos</label>
                    <select name="category" className="form-control">
                      <option value="MATERIAL">MATERIAL</option>
                      <option value="UPAH">UPAH</option>
                      <option value="SUBKON">SUBKON</option>
                      <option value="SEWA_ALAT">SEWA_ALAT</option>
                      <option value="OPS_LAPANGAN">OPS_LAPANGAN</option>
                      <option value="LAINNYA">LAINNYA</option>
                    </select>
                  </div>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Uraian Pekerjaan / Material</label>
                  <input
                    type="text"
                    name="description"
                    required
                    placeholder="Contoh: Pekerjaan Cor Beton Lantai 2 / Semen Gresik"
                    className="form-control"
                  />
                </div>
                <div className="grid-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Volume</label>
                    <input type="number" step="any" name="volume" defaultValue={1} required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satuan</label>
                    <input type="text" name="unit" defaultValue="ls" required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harga Satuan (Rp)</label>
                    <input type="number" step="any" name="unitPrice" required placeholder="0" className="form-control" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowBudgetItemModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Menyimpan..." : "Tambah ke RAP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Tambah Termin */}
      {showTerminModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Tambah Rencana Termin Penagihan</h2>
              <button onClick={() => setShowTerminModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleCreateTermin}>
              <input type="hidden" name="projectId" value={project.id} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Nomor Termin</label>
                    <input type="number" name="terminNumber" defaultValue={termins.length + 1} required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rencana Nominal (Rp)</label>
                    <input type="number" step="any" name="plannedAmount" required placeholder="Contoh: 1000000000" className="form-control" />
                  </div>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Nama / Uraian Termin</label>
                  <input type="text" name="name" required placeholder="Contoh: Termin 1 - Uang Muka (DP) 20%" className="form-control" />
                </div>
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">No. Invoice (Opsional)</label>
                    <input type="text" name="invoiceNumber" placeholder="INV-2026-001" className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tanggal Invoice (Opsional)</label>
                    <input type="date" name="invoiceDate" className="form-control" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowTerminModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Menyimpan..." : "Simpan Termin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Catat Pelunasan / Kas Masuk Termin */}
      {showPayTerminModal && selectedTermin && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>Catat Penerimaan Kas Termin</h2>
              <button onClick={() => setShowPayTerminModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handlePayTermin}>
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="terminId" value={selectedTermin.id} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="alert alert-info mb-4" style={{ fontSize: "0.8rem" }}>
                  Mencatat penerimaan termin akan <strong>otomatis membukukan Fund Inflow (Kas Masuk POSTED)</strong> dan menambah saldo rekening kas/bank riil tanpa duplikasi jurnal.
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Termin yang Diterima</label>
                  <div className="font-semibold text-slate-800">
                    Termin #{selectedTermin.terminNumber}: {selectedTermin.name}
                  </div>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Rekening Kas/Bank Penerima</label>
                  <select name="destinationAccountId" required className="form-control">
                    <option value="">-- Pilih Rekening Kas / Bank --</option>
                    {lookups.cashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.accountCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Nominal Diterima (Rp)</label>
                    <input
                      type="number"
                      step="any"
                      name="amount"
                      defaultValue={Number(selectedTermin.plannedAmount)}
                      required
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tanggal Diterima</label>
                    <input
                      type="date"
                      name="receivedDate"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                      className="form-control"
                    />
                  </div>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Nomor Referensi Transfer / Bukti (Opsional)</label>
                  <input type="text" name="referenceNo" placeholder="No. ref transfer bank" className="form-control" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowPayTerminModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Membukukan Kas..." : "Posting Kas Masuk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Catat Progres Fisik Sipil */}
      {showProgressModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Catat Opname Progres Fisik Lapangan</h2>
              <button onClick={() => setShowProgressModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleCreateProgress}>
              <input type="hidden" name="projectId" value={project.id} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Tanggal Opname</label>
                    <input
                      type="date"
                      name="logDate"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Persentase Fisik (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      name="physicalProgressPct"
                      required
                      placeholder="Contoh: 85.50"
                      className="form-control"
                    />
                  </div>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Capaian Volume / Tahap Pekerjaan</label>
                  <textarea
                    name="volumeDescription"
                    rows={2}
                    placeholder="Contoh: Pekerjaan struktur lantai 2 selesai 100%, dinding bata terpasang 40%"
                    className="form-control"
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Sumber Informasi / Tim Sipil Pelapor</label>
                  <input
                    type="text"
                    name="sourceInfo"
                    defaultValue="Bagian Sipil / Pengawas Lapangan"
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowProgressModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Menyimpan..." : "Simpan Progres Fisik"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal Tambah Rincian Material untuk Item ACC */}
      {showMaterialModal && selectedAccItem && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2>Tambah Rincian Material / Barang</h2>
              <button onClick={() => setShowMaterialModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleCreateMaterialDetail}>
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="accItemId" value={selectedAccItem.id} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 mb-3">
                  Item ACC: <strong>{selectedAccItem.noKas}</strong> — {selectedAccItem.description} (Disetujui: {formatRupiah(Number(selectedAccItem.approvedAmount))})
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Nama Barang / Material</label>
                  <input type="text" name="itemName" required placeholder="Contoh: Semen Tiga Roda 50kg" className="form-control" />
                </div>
                <div className="grid-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Kuantitas</label>
                    <input type="number" step="any" name="quantity" defaultValue={1} required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satuan</label>
                    <input type="text" name="unit" defaultValue="sak" required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harga Satuan (Rp)</label>
                    <input type="number" step="any" name="unitPrice" required placeholder="0" className="form-control" />
                  </div>
                </div>
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Vendor / Toko (Opsional)</label>
                    <select name="vendorId" className="form-control">
                      <option value="NONE">-- Pilih Vendor / Toko --</option>
                      {lookups.vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. Bukti / Nota (Opsional)</label>
                    <input type="text" name="referenceNo" placeholder="No. nota toko" className="form-control" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowMaterialModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Menyimpan..." : "Tambah Rincian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal Tambah Kontrak Vendor */}
      {showVendorContractModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2>Tambah SPK / Kontrak Vendor</h2>
              <button onClick={() => setShowVendorContractModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleCreateVendorContract}>
              <input type="hidden" name="projectId" value={project.id} />
              <div className="modal-body">
                {errorMsg && <div className="alert alert-danger mb-4">{errorMsg}</div>}
                <div className="form-group mb-3">
                  <label className="form-label">Pilih Rekanan Vendor / Subkon</label>
                  <select name="vendorId" required className="form-control">
                    <option value="">-- Pilih Rekanan Master Vendor --</option>
                    {lookups.vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                    ))}
                  </select>
                </div>
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Nomor SPK / Kontrak</label>
                    <input type="text" name="contractNumber" required placeholder="SPK-2026-SUB-01" className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nilai Kontrak (Rp)</label>
                    <input type="number" step="any" name="contractValue" required placeholder="0" className="form-control" />
                  </div>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Judul Pekerjaan / SPK</label>
                  <input type="text" name="title" required placeholder="Contoh: Pekerjaan Borongan Kusen & Pintu" className="form-control" />
                </div>
                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Mulai</label>
                    <input type="date" name="startDate" className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selesai</label>
                    <input type="date" name="endDate" className="form-control" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowVendorContractModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "Menyimpan..." : "Simpan Kontrak Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
