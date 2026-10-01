import Link from "next/link";
import { getPicDistributionData } from "../actions/pic.actions";
import { formatRupiah, accStatusLabel } from "@/lib/utils/format";
import PicFilters from "./PicFilters";

export default async function PicDistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ picId?: string; projectId?: string; status?: string }>;
}) {
  const params = await searchParams;
  const data = await getPicDistributionData(params);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Distribusi PIC Lapangan</h1>
          <div className="page-header-subtitle">
            Monitoring alokasi dana ACC, realisasi pencairan, dan sisa outstanding per penanggung jawab
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Filter Bar */}
        <PicFilters pics={data.pics} projects={data.projects} />

        {/* Aggregate Stats */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Total Dana ACC</div>
            <div className="stat-value">{formatRupiah(data.totals.totalApproved)}</div>
            <div className="stat-sub">{data.totals.totalItems} transaksi ACC</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Terealisasi</div>
            <div className="stat-value font-semibold" style={{ color: "var(--color-primary)" }}>
              {formatRupiah(data.totals.totalRealized)}
            </div>
            <div className="stat-sub">
              {data.totals.totalApproved > 0
                ? `${((data.totals.totalRealized / data.totals.totalApproved) * 100).toFixed(1)}% dicairkan`
                : "0%"}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Outstanding (Sisa)</div>
            <div
              className="stat-value"
              style={{
                color: data.totals.totalOutstanding > 0 ? "var(--color-warning)" : "var(--color-success)",
              }}
            >
              {formatRupiah(data.totals.totalOutstanding)}
            </div>
            <div className="stat-sub">Belum dicairkan ke PIC</div>
          </div>
        </div>

        {/* Per-PIC Cards Overview */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3">Ringkasan per PIC</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {data.picSummaries.map((pic) => {
              const pct =
                pic.totalApproved > 0
                  ? Math.round((pic.totalRealized / pic.totalApproved) * 100)
                  : 0;

              return (
                <div key={pic.picId} className="card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-base">{pic.picName}</div>
                      {pic.roleTitle && (
                        <div
                          className="text-xs font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block"
                          style={{
                            background:
                              pic.roleTitle === "ADMINISTRATIVE_SUBMITTER"
                                ? "rgba(147, 51, 234, 0.1)"
                                : pic.roleTitle === "MANDOR_BELUM_DITENTUKAN"
                                ? "rgba(234, 88, 12, 0.1)"
                                : "var(--color-bg-alt)",
                            color:
                              pic.roleTitle === "ADMINISTRATIVE_SUBMITTER"
                                ? "#9333ea"
                                : pic.roleTitle === "MANDOR_BELUM_DITENTUKAN"
                                ? "#ea580c"
                                : "var(--color-primary)",
                          }}
                        >
                          {pic.roleTitle}
                        </div>
                      )}
                      <div className="text-xs text-muted mt-1">{pic.itemCount} item ACC</div>
                    </div>
                    <span
                      className="status status-info"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                    >
                      {pct}% Realisasi
                    </span>
                  </div>

                  <div className="text-xs space-y-1 mb-3 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <div className="flex justify-between">
                      <span className="text-muted">Total ACC:</span>
                      <span className="font-medium">{formatRupiah(pic.totalApproved)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Realisasi:</span>
                      <span className="font-medium text-primary">{formatRupiah(pic.totalRealized)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Outstanding:</span>
                      <span
                        className="font-semibold"
                        style={{ color: pic.totalOutstanding > 0 ? "var(--color-warning)" : "var(--color-success)" }}
                      >
                        {formatRupiah(pic.totalOutstanding)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      height: 6,
                      background: "var(--bg-subtle)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "var(--color-primary)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Items Table */}
        <div className="card">
          <div className="card-header">
            <h2>Rincian Item per PIC</h2>
            <span className="text-sm text-secondary">{data.items.length} item ditemukan</span>
          </div>
          <div className="card-body-flush">
            {data.items.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👷</div>
                <div className="empty-state-title">Tidak ada item ditemukan</div>
                <div className="empty-state-desc">
                  Belum ada item ACC yang cocok dengan filter yang dipilih.
                </div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No Kas</th>
                    <th>PIC / Mandor</th>
                    <th>Proyek</th>
                    <th>Kategori</th>
                    <th>Uraian</th>
                    <th className="text-right">Nominal ACC</th>
                    <th className="text-right">Realisasi</th>
                    <th className="text-right">Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const statusInfo = accStatusLabel(item.status);
                    return (
                      <tr key={item.id}>
                        <td className="col-mono font-medium">{item.noKas}</td>
                        <td>
                          <div className="font-medium">{item.picName}</div>
                          {item.assignmentStatus === "UNASSIGNED_MANDOR" ? (
                            <span
                              className="text-[10px] px-1 py-0.5 rounded font-bold"
                              style={{ background: "#ffedd5", color: "#c2410c" }}
                            >
                              UNASSIGNED MANDOR
                            </span>
                          ) : item.picName === "NISA" ? (
                            <span
                              className="text-[10px] px-1 py-0.5 rounded font-bold"
                              style={{ background: "#f3e8ff", color: "#7e22ce" }}
                            >
                              ADM SUBMITTER
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span className="font-medium">{item.projectCode}</span>
                        </td>
                        <td className="text-sm text-muted">{item.categoryName}</td>
                        <td className="truncate" style={{ maxWidth: 220 }}>
                          {item.description}
                        </td>
                        <td className="col-num font-medium">
                          {formatRupiah(item.approvedAmount)}
                        </td>
                        <td className="col-num text-primary">
                          {formatRupiah(item.realizedAmount)}
                        </td>
                        <td className="col-num font-semibold">
                          {item.outstandingAmount > 0 ? (
                            <span style={{ color: "var(--color-warning)" }}>
                              {formatRupiah(item.outstandingAmount)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--color-success)" }}>Rp0</span>
                          )}
                        </td>
                        <td>
                          <span className={`status ${statusInfo.className}`}>
                            <span className="status-dot"></span>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
