import React from "react";
import Link from "next/link";
import { getProjectReport } from "@/lib/reports/project-report.service";
import { formatRupiah } from "@/lib/utils/format";
import ExportButtons from "../ExportButtons";
import ReportFilterBar from "../ReportFilterBar";
import { ProjectIcon } from "../../components/Icons";
import { PageMotion, StaggerCards } from "../../components/GsapMotion";

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
  const data = await getProjectReport(params);

  const filterConfig = {
    showDates: true,
    projects: data.allProjects.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` })),
  };

  return (
    <PageMotion>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Monitoring & Pengendalian Biaya Proyek (Project 360°)</h2>
          <div className="text-xs text-muted">
            Rekapitulasi nilai kontrak, penerimaan termin, realisasi biaya keluar, saldo penerimaan bersih, dan progres fisik lapangan
          </div>
        </div>
        <ExportButtons reportType="project" />
      </div>

      <ReportFilterBar config={filterConfig} />

      <StaggerCards className="stat-grid mb-6">
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Nilai Kontrak</div>
            <div className="stat-value primary">{formatRupiah(data.totals.totalContractValue)}</div>
          </div>
          <div className="stat-sub">Plafon kontrak induk aktif</div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Penerimaan (Masuk)</div>
            <div className="stat-value positive">{formatRupiah(data.totals.totalInflow)}</div>
          </div>
          <div className="stat-sub">Dana masuk riil diposting</div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Biaya Realisasi (Keluar)</div>
            <div className="stat-value">{formatRupiah(data.totals.totalRealized)}</div>
          </div>
          <div className="stat-sub">
            ACC sah: {formatRupiah(data.totals.totalApproved)}
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Saldo Penerimaan Bersih</div>
            <div className={`stat-value ${data.totals.totalNetBalance >= 0 ? "positive" : "warning"}`}>
              {formatRupiah(data.totals.totalNetBalance)}
            </div>
          </div>
          <div className="stat-sub">Penerimaan Masuk − Biaya Keluar</div>
        </div>
      </StaggerCards>

      <div className="card">
        <div className="card-body-flush">
          {data.projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <ProjectIcon size={32} className="text-slate-400" />
              </div>
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
                    <th>Proyek / Kategori Biaya</th>
                    <th className="text-right">Nilai Kontrak</th>
                    <th className="text-right">Penerimaan</th>
                    <th className="text-right">Biaya Keluar</th>
                    <th className="text-right">Saldo Bersih</th>
                    <th className="text-center">Progres Penerimaan</th>
                    <th className="text-center">Progres Fisik</th>
                    <th className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((proj) => {
                    return (
                      <React.Fragment key={proj.projectId}>
                        {/* Parent Project Header Row */}
                        <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                          <td>
                            <Link
                              href={`/projects/${proj.projectId}`}
                              className="font-bold text-primary hover:underline text-sm"
                            >
                              {proj.projectCode}
                            </Link>{" "}
                            — {proj.projectName}
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
                          <td className="col-num font-semibold">
                            {proj.contractValue !== null ? formatRupiah(proj.contractValue) : "-"}
                          </td>
                          <td className="col-num font-semibold positive">
                            {formatRupiah(proj.totalInflow)}
                          </td>
                          <td className="col-num font-semibold text-primary">
                            {formatRupiah(proj.realizedAmount)}
                          </td>
                          <td className="col-num font-semibold" style={{ color: proj.netBalance >= 0 ? "var(--color-success)" : "var(--color-warning)" }}>
                            {formatRupiah(proj.netBalance)}
                          </td>
                          <td className="text-center">
                            {proj.receiptProgressPct !== null ? (
                              <span className="status status-info" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                                {proj.receiptProgressPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted">-</span>
                            )}
                          </td>
                          <td className="text-center">
                            {proj.physicalProgressPct !== null ? (
                              <span className="status status-success font-bold" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                                {proj.physicalProgressPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                Belum ada
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <Link
                              href={`/projects/${proj.projectId}`}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                            >
                              Detail 360° →
                            </Link>
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
                              <td className="col-num text-xs text-muted">-</td>
                              <td className="col-num text-xs text-muted">-</td>
                              <td className="col-num text-sm text-primary font-medium">{formatRupiah(cat.realizedAmount)}</td>
                              <td className="col-num text-xs text-muted">
                                ACC: {formatRupiah(cat.approvedAmount)}
                              </td>
                              <td className="text-center text-xs text-muted">{catPct}% cair</td>
                              <td className="text-center text-xs text-muted">-</td>
                              <td></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                    <td>TOTAL KESELURUHAN:</td>
                    <td className="col-num">{formatRupiah(data.totals.totalContractValue)}</td>
                    <td className="col-num positive">{formatRupiah(data.totals.totalInflow)}</td>
                    <td className="col-num text-primary">{formatRupiah(data.totals.totalRealized)}</td>
                    <td className="col-num" style={{ color: data.totals.totalNetBalance >= 0 ? "var(--color-success)" : "var(--color-warning)" }}>
                      {formatRupiah(data.totals.totalNetBalance)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageMotion>
  );
}
