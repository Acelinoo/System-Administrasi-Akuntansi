import React from "react";
import { getPicReport } from "@/lib/reports/pic-report.service";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah, formatDate, accStatusLabel } from "@/lib/utils/format";
import ExportButtons from "../ExportButtons";
import ReportFilterBar from "../ReportFilterBar";

export default async function PicReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    picId?: string;
    projectId?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const [data, pics, projects] = await Promise.all([
    getPicReport(params),
    prisma.fieldPic.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
  ]);

  const filterConfig = {
    showDates: true,
    pics: pics.map((p) => ({ id: p.id, name: p.name })),
    projects: projects.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` })),
    statuses: [
      { value: "APPROVED", label: "APPROVED" },
      { value: "PARTIALLY_REALIZED", label: "PARTIALLY REALIZED" },
      { value: "FULLY_REALIZED", label: "FULLY REALIZED" },
    ],
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Laporan Monitoring PIC Lapangan</h2>
          <div className="text-xs text-muted">
            Rekapitulasi pengajuan dana, realisasi pencairan, dan sisa outstanding per person-in-charge
          </div>
        </div>
        <ExportButtons reportType="pic" />
      </div>

      <ReportFilterBar config={filterConfig} />

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Alokasi PIC (ACC)</div>
          <div className="stat-value">{formatRupiah(data.totals.totalApproved)}</div>
          <div className="stat-sub">{data.totals.picCount} PIC terdaftar</div>
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
          <div className="stat-label">Sisa Outstanding PIC</div>
          <div
            className="stat-value font-semibold"
            style={{
              color: data.totals.totalOutstanding > 0 ? "var(--color-warning)" : "var(--color-success)",
            }}
          >
            {formatRupiah(data.totals.totalOutstanding)}
          </div>
          <div className="stat-sub">Dana belum direalisasikan</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          {data.pics.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👷</div>
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
                    <th>No Kas</th>
                    <th>Tanggal ACC</th>
                    <th>Proyek</th>
                    <th>Kategori</th>
                    <th>Uraian Transaksi</th>
                    <th className="text-right">Nominal ACC</th>
                    <th className="text-right">Realisasi</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pics.map((p) => (
                    <React.Fragment key={p.picId}>
                      {/* PIC Group Header Row */}
                      <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                        <td colSpan={5}>
                          <span className="font-semibold text-primary">PIC: {p.picName}</span>
                          {p.roleTitle && <span className="text-xs text-muted" style={{ marginLeft: 6 }}>({p.roleTitle})</span>}
                          <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                            — {p.itemCount} transaksi
                          </span>
                        </td>
                        <td className="col-num font-semibold">{formatRupiah(p.approvedAmount)}</td>
                        <td className="col-num font-semibold text-primary">{formatRupiah(p.realizedAmount)}</td>
                        <td className="col-num font-semibold" style={{ color: p.outstandingAmount > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                          {formatRupiah(p.outstandingAmount)}
                        </td>
                        <td></td>
                      </tr>

                      {/* Detail Transactions under PIC */}
                      {p.items.map((item) => {
                        const statusInfo = accStatusLabel(item.status);
                        return (
                          <tr key={item.id}>
                            <td className="col-mono text-sm">{item.noKas}</td>
                            <td className="text-sm">{formatDate(item.accDate)}</td>
                            <td className="text-sm font-medium">{item.projectCode}</td>
                            <td className="text-xs text-muted">{item.categoryName}</td>
                            <td className="truncate" style={{ maxWidth: 220 }}>
                              {item.description}
                            </td>
                            <td className="col-num text-sm">{formatRupiah(item.approvedAmount)}</td>
                            <td className="col-num text-sm text-primary">{formatRupiah(item.realizedAmount)}</td>
                            <td className="col-num text-sm font-semibold">
                              {item.outstandingAmount > 0 ? (
                                <span style={{ color: "var(--color-warning)" }}>{formatRupiah(item.outstandingAmount)}</span>
                              ) : (
                                <span style={{ color: "var(--color-success)" }}>Rp0</span>
                              )}
                            </td>
                            <td className="text-center">
                              <span className={`status ${statusInfo.className}`} style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                                {statusInfo.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                    <td colSpan={5} className="text-right">TOTAL SELURUH PIC:</td>
                    <td className="col-num">{formatRupiah(data.totals.totalApproved)}</td>
                    <td className="col-num text-primary">{formatRupiah(data.totals.totalRealized)}</td>
                    <td className="col-num" style={{ color: "var(--color-warning)" }}>
                      {formatRupiah(data.totals.totalOutstanding)}
                    </td>
                    <td></td>
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
