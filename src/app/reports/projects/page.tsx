import { getProjectReport } from "@/lib/reports/project-report.service";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah } from "@/lib/utils/format";
import ExportButtons from "../ExportButtons";
import ReportFilterBar from "../ReportFilterBar";

export default async function ProjectReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    projectId?: string;
  }>;
}) {
  const params = await searchParams;
  const [data, projects] = await Promise.all([
    getProjectReport(params),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
  ]);

  const filterConfig = {
    showDates: true,
    projects: projects.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` })),
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Laporan Rekapitulasi Alokasi Dana per Proyek</h2>
          <div className="text-xs text-muted">
            Ringkasan alokasi ACC, realisasi pencairan, dan sisa outstanding per proyek beserta breakdown kategori
          </div>
        </div>
        <ExportButtons reportType="project" />
      </div>

      <ReportFilterBar config={filterConfig} />

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Pengajuan Seluruh Proyek</div>
          <div className="stat-value">{formatRupiah(data.totals.totalApproved)}</div>
          <div className="stat-sub">{data.totals.projectCount} proyek aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Terealisasi</div>
          <div className="stat-value text-primary font-semibold">
            {formatRupiah(data.totals.totalRealized)}
          </div>
          <div className="stat-sub">
            {data.totals.totalApproved > 0
              ? `${((data.totals.totalRealized / data.totals.totalApproved) * 100).toFixed(1)}% dicairkan`
              : "0%"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sisa Outstanding</div>
          <div
            className="stat-value font-semibold"
            style={{
              color: data.totals.totalOutstanding > 0 ? "var(--color-warning)" : "var(--color-success)",
            }}
          >
            {formatRupiah(data.totals.totalOutstanding)}
          </div>
          <div className="stat-sub">Kewajiban pengeluaran tersisa</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          {data.projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏗️</div>
              <div className="empty-state-title">Tidak ada data untuk filter yang dipilih.</div>
              <div className="empty-state-desc">
                Silakan sesuaikan tanggal atau pilihan filter di atas.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Proyek / Pos Kategori Biaya</th>
                    <th className="text-right">Total Disetujui (ACC)</th>
                    <th className="text-right">Terealisasi (Keluar)</th>
                    <th className="text-right">Sisa Outstanding</th>
                    <th className="text-center">Progres</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((proj) => {
                    const pct =
                      proj.approvedAmount > 0
                        ? ((proj.realizedAmount / proj.approvedAmount) * 100).toFixed(1)
                        : "0.0";

                    return (
                      <React.Fragment key={proj.projectId}>
                        {/* Parent Project Header Row */}
                        <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                          <td>
                            <span className="font-semibold text-primary">{proj.projectCode}</span> — {proj.projectName}
                            {proj.confirmationStatus === "REQUIRES_BUSINESS_CONFIRMATION" && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-bold ml-2"
                                style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                              >
                                KANDIDAT — BUTUH KONFIRMASI
                              </span>
                            )}
                            <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                              ({proj.itemCount} item)
                            </span>
                          </td>
                          <td className="col-num font-semibold">{formatRupiah(proj.approvedAmount)}</td>
                          <td className="col-num font-semibold text-primary">{formatRupiah(proj.realizedAmount)}</td>
                          <td className="col-num font-semibold" style={{ color: proj.outstandingAmount > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                            {formatRupiah(proj.outstandingAmount)}
                          </td>
                          <td className="text-center">
                            <span className="status status-info" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                              {pct}%
                            </span>
                          </td>
                        </tr>

                        {/* Breakdown Categories under this Project */}
                        {proj.categories.map((cat) => {
                          const catPct =
                            cat.approvedAmount > 0
                              ? ((cat.realizedAmount / cat.approvedAmount) * 100).toFixed(1)
                              : "0.0";
                          return (
                            <tr key={`${proj.projectId}-${cat.categoryId}`}>
                              <td style={{ paddingLeft: 32 }}>
                                <span className="text-muted">↳</span> <span className="font-medium">{cat.categoryCode}</span> — {cat.categoryName}
                              </td>
                              <td className="col-num text-sm">{formatRupiah(cat.approvedAmount)}</td>
                              <td className="col-num text-sm text-primary">{formatRupiah(cat.realizedAmount)}</td>
                              <td className="col-num text-sm font-medium">
                                {cat.outstandingAmount > 0 ? (
                                  <span style={{ color: "var(--color-warning)" }}>{formatRupiah(cat.outstandingAmount)}</span>
                                ) : (
                                  <span style={{ color: "var(--color-success)" }}>Rp0</span>
                                )}
                              </td>
                              <td className="text-center text-xs text-muted">{catPct}%</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                    <td className="text-right">TOTAL KESELURUHAN:</td>
                    <td className="col-num">{formatRupiah(data.totals.totalApproved)}</td>
                    <td className="col-num text-primary">{formatRupiah(data.totals.totalRealized)}</td>
                    <td className="col-num" style={{ color: "var(--color-warning)" }}>
                      {formatRupiah(data.totals.totalOutstanding)}
                    </td>
                    <td className="text-center">
                      {data.totals.totalApproved > 0
                        ? `${((data.totals.totalRealized / data.totals.totalApproved) * 100).toFixed(1)}%`
                        : "0%"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import React from "react";
