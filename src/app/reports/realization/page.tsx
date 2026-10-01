import { getRealizationReport } from "@/lib/reports/realization-report.service";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import ExportButtons from "../ExportButtons";
import ReportFilterBar from "../ReportFilterBar";

export default async function RealizationReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    projectId?: string;
    picId?: string;
    cashAccountId?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const [data, projects, pics, accounts] = await Promise.all([
    getRealizationReport(params),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
    prisma.fieldPic.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.cashAccount.findMany({ where: { isActive: true }, select: { id: true, accountName: true, accountCode: true } }),
  ]);

  const filterConfig = {
    showDates: true,
    projects: projects.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` })),
    pics: pics.map((p) => ({ id: p.id, name: p.name })),
    accounts: accounts.map((a) => ({ id: a.id, name: `${a.accountName} (${a.accountCode})` })),
    statuses: [
      { value: "POSTED", label: "POSTED (Berhasil)" },
      { value: "VOID", label: "VOID (Dibatalkan)" },
    ],
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Laporan Realisasi Pencairan Dana</h2>
          <div className="text-xs text-muted">
            Riwayat voucher pencairan dana kas/bank ke PIC lapangan beserta rincian item
          </div>
        </div>
        <ExportButtons reportType="realization" />
      </div>

      <ReportFilterBar config={filterConfig} />

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Realisasi (POSTED)</div>
          <div className="stat-value text-primary font-semibold">
            {formatRupiah(data.totals.totalRealized)}
          </div>
          <div className="stat-sub">{data.totals.count} item transaksi pencairan aktif</div>
        </div>
      </div>

      {/* HOLDING STATE: Realisasi Kandidat Sumber Excel */}
      <div className="card mb-6" style={{ background: "#fffbeb", border: "1px solid #fef3c7" }}>
        <div className="card-body">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded font-bold"
                style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
              >
                HOLDING STATE — PENDING CONFIRMATION
              </span>
              <span className="font-semibold text-sm" style={{ color: "#92400e" }}>
                4 Transaksi Catatan Realisasi Excel Tertahan (Total: Rp34.299.517)
              </span>
            </div>
            <span className="text-xs font-mono font-semibold" style={{ color: "#b45309" }}>
              Status: Belum Terposting
            </span>
          </div>
          <p className="text-xs text-secondary mb-3">
            Transaksi ini tercatat pada kolom realisasi Excel sumber, namun <strong>tidak dimasukkan</strong> ke saldo kas,
            disbursement aktif, maupun jurnal akuntansi karena memerlukan konfirmasi definitif terkait akun kas/bank pembayar
            dan tanggal efektif posting.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ background: "#ffffff", fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  <th>No Kas</th>
                  <th>Uraian Pengeluaran</th>
                  <th>Catatan Realisasi Sumber</th>
                  <th className="text-right">Nominal Tertahan</th>
                  <th className="text-center">Status Sistem</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="col-mono font-medium">KT.26.180</td>
                  <td>Upah Tukang RT Bu Ani Minggu Lalu</td>
                  <td className="text-xs text-muted">Tgl 21/01/26 1.356.000</td>
                  <td className="col-num font-semibold">Rp1.356.000</td>
                  <td className="text-center">
                    <span className="status status-warning" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                      PENDING CONFIRMATION
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="col-mono font-medium">KT.26.180</td>
                  <td>Upah Tukang RT Bu Ani Minggu ini</td>
                  <td className="text-xs text-muted">Tgl 21/01/26 3.162.000</td>
                  <td className="col-num font-semibold">Rp3.162.000</td>
                  <td className="text-center">
                    <span className="status status-warning" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                      PENDING CONFIRMATION
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="col-mono font-medium">KT.26.214</td>
                  <td>Sisa Pemb Matrial Cat,Tiner,Kyu,Semen Sumedang</td>
                  <td className="text-xs text-muted">Tgl 22/01/26 22.512.000</td>
                  <td className="col-num font-semibold">Rp22.512.000</td>
                  <td className="text-center">
                    <span className="status status-warning" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                      PENDING CONFIRMATION
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="col-mono font-medium">KT.26.652</td>
                  <td>Talangan Nisa Kekurangan Pembelian Sanitair Sumedang</td>
                  <td className="text-xs text-muted">Tgl 05/02/26 7.269.517</td>
                  <td className="col-num font-semibold">Rp7.269.517</td>
                  <td className="text-center">
                    <span className="status status-warning" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                      PENDING CONFIRMATION
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          {data.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💸</div>
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
                    <th>Tanggal</th>
                    <th>No. Voucher</th>
                    <th>No Kas ACC</th>
                    <th>Proyek</th>
                    <th>PIC</th>
                    <th>Akun Pembayar</th>
                    <th>Metode</th>
                    <th>Uraian Item</th>
                    <th className="text-right">Nominal Dicairkan</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const txInfo = txStatusLabel(item.status);
                    return (
                      <tr key={item.id}>
                        <td className="text-sm">{formatDate(item.disbursementDate)}</td>
                        <td className="col-mono font-medium">{item.voucherNumber}</td>
                        <td className="col-mono">{item.noKas}</td>
                        <td className="font-medium">{item.projectCode}</td>
                        <td>{item.picName}</td>
                        <td className="text-sm">{item.payerAccountName}</td>
                        <td>
                          <span className="status status-neutral" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                            {item.paymentMethod}
                          </span>
                        </td>
                        <td className="truncate" style={{ maxWidth: 220 }}>
                          {item.description}
                        </td>
                        <td className="col-num font-semibold">
                          {formatRupiah(item.realizedAmount)}
                        </td>
                        <td className="text-center">
                          <span className={`status ${txInfo.className}`}>
                            <span className="status-dot"></span>
                            {txInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                    <td colSpan={8} className="text-right">
                      TOTAL REALISASI (POSTED ONLY):
                    </td>
                    <td className="col-num text-primary">
                      {formatRupiah(data.totals.totalRealized)}
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
