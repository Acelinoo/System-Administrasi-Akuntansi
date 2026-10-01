import { getAccReport } from "@/lib/reports/acc-report.service";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah, formatDate, accStatusLabel } from "@/lib/utils/format";
import ExportButtons from "../ExportButtons";
import ReportFilterBar from "../ReportFilterBar";

export default async function AccReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    projectId?: string;
    subUnitId?: string;
    categoryId?: string;
    picId?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const [data, projects, categories, pics] = await Promise.all([
    getAccReport(params),
    prisma.project.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        subUnits: {
          where: { isActive: true },
          select: { id: true, code: true, name: true, projectId: true },
        },
      },
    }),
    prisma.expenseCategory.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
    prisma.fieldPic.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ]);

  const allSubUnits = projects.flatMap((p) =>
    p.subUnits.map((su) => ({
      id: su.id,
      name: `${p.code} / ${su.code} - ${su.name}`,
      projectId: su.projectId,
    }))
  );

  const filterConfig = {
    showDates: true,
    projects: projects.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` })),
    subUnits: allSubUnits,
    categories: categories.map((c) => ({ id: c.id, name: `${c.code} - ${c.name}` })),
    pics: pics.map((p) => ({ id: p.id, name: p.name })),
    statuses: [
      { value: "APPROVED", label: "APPROVED (Belum Cair)" },
      { value: "PARTIALLY_REALIZED", label: "PARTIALLY REALIZED" },
      { value: "FULLY_REALIZED", label: "FULLY REALIZED (Lunas)" },
      { value: "CANCELLED", label: "CANCELLED" },
    ],
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Laporan Rekapitulasi Data ACC</h2>
          <div className="text-xs text-muted">
            Monitoring data hasil ACC atasan, realisasi pencairan, dan sisa outstanding
          </div>
        </div>
        <ExportButtons reportType="acc" />
      </div>

      <ReportFilterBar config={filterConfig} />

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Data ACC</div>
          <div className="stat-value">{formatRupiah(data.totals.totalApproved)}</div>
          <div className="stat-sub">{data.totals.count} item transaksi</div>
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
          <div className="stat-label">Sisa Outstanding</div>
          <div
            className="stat-value font-semibold"
            style={{
              color: data.totals.totalOutstanding > 0 ? "var(--color-warning)" : "var(--color-success)",
            }}
          >
            {formatRupiah(data.totals.totalOutstanding)}
          </div>
          <div className="stat-sub">Belum direalisasikan</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          {data.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
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
                    <th>Sub</th>
                    <th>Kategori</th>
                    <th>PIC</th>
                    <th>Uraian Pengeluaran</th>
                    <th className="text-right">Nominal ACC</th>
                    <th className="text-right">Realisasi</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const statusInfo = accStatusLabel(item.status);
                    return (
                      <tr key={item.id}>
                        <td className="col-mono font-medium">{item.noKas}</td>
                        <td className="text-sm">{formatDate(item.accDate)}</td>
                        <td className="font-medium">{item.projectCode}</td>
                        <td className="text-xs text-muted">{item.subUnitCode || "-"}</td>
                        <td className="text-sm">{item.categoryName}</td>
                        <td className="font-medium">{item.picName}</td>
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
                        <td className="text-center">
                          <span className={`status ${statusInfo.className}`}>
                            <span className="status-dot"></span>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                    <td colSpan={7} className="text-right">
                      TOTAL ({data.items.length} Item):
                    </td>
                    <td className="col-num">{formatRupiah(data.totals.totalApproved)}</td>
                    <td className="col-num text-primary">
                      {formatRupiah(data.totals.totalRealized)}
                    </td>
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
