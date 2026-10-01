import Link from "next/link";
import { getDisbursementList } from "../actions/disbursement.actions";
import { getDashboardStats } from "../actions/acc.actions";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import { PlusIcon } from "../components/Icons";

export default async function DisbursementListPage() {
  const [disbursements, stats] = await Promise.all([
    getDisbursementList(),
    getDashboardStats(),
  ]);

  const postedDisbursements = disbursements.filter((d) => d.status === "POSTED");
  const totalPosted = postedDisbursements.reduce(
    (sum, d) => sum + Number(d.totalRealizedAmount),
    0
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Realisasi Pencairan</h1>
          <div className="page-header-subtitle">
            Pencatatan realisasi pengeluaran kas proyek berdasarkan data ACC yang telah sah
          </div>
        </div>
        <Link href="/disbursements/new" className="btn btn-primary">
          <PlusIcon size={14} />
          <span>Pencairan Baru</span>
        </Link>
      </div>

      <div className="page-body">
        {/* 1. 4 SUMMARY CARDS (MONETIRA STYLE) */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Total Realisasi (Posted)</div>
              <div className="stat-value">{formatRupiah(totalPosted)}</div>
            </div>
            <div className="stat-sub">Voucher pencairan sah terposting</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Total Sisa Outstanding</div>
              <div className={`stat-value ${stats.totalOutstandingAmount > 0 ? "warning" : "positive"}`}>
                {formatRupiah(stats.totalOutstandingAmount)}
              </div>
            </div>
            <div className="stat-sub">Kewajiban ACC belum dicairkan</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Jumlah Transaksi</div>
              <div className="stat-value">{disbursements.length}</div>
            </div>
            <div className="stat-sub">{postedDisbursements.length} voucher posted</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Dasar Alokasi ACC</div>
              <div className="stat-value primary">{formatRupiah(stats.totalAccAmount)}</div>
            </div>
            <div className="stat-sub">{stats.totalAccItems} item ACC terdaftar</div>
          </div>
        </div>

        {/* 2. HOLDING STATE NOTICE (RESTRAINED ELEGANT CALLOUT) */}
        <div className="card mb-6" style={{ background: "#fffbeb", border: "1px solid #fef3c7" }}>
          <div className="card-body" style={{ padding: "14px 18px" }}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
              >
                HOLDING STATE
              </span>
              <span className="font-semibold text-xs text-slate-800">
                4 Catatan Realisasi Sumber Excel (Rp34.299.517) Tertahan di PENDING_CONFIRMATION
              </span>
            </div>
            <div className="text-xs text-secondary mt-1">
              Transaksi realisasi sumber Excel belum diposting ke voucher pencairan karena menunggu konfirmasi resmi mengenai akun kas/bank pembayar dan tanggal efektif pembukuan.
            </div>
          </div>
        </div>

        {/* 3. TRANSACTION TABLE */}
        <div className="card">
          <div className="card-header">
            <h2>Daftar Voucher Pencairan / Realisasi</h2>
            <span className="text-xs text-muted font-medium">{disbursements.length} voucher tercatat</span>
          </div>
          <div className="card-body-flush">
            {disbursements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <div className="empty-state-title">Belum ada voucher pencairan</div>
                <div className="empty-state-desc">
                  Setelah data ACC dicatatkan, Anda dapat mencatatkan pencairan/realisasinya melalui tombol di atas.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. Pencairan</th>
                      <th>Tanggal</th>
                      <th>Metode</th>
                      <th>Akun Pembayar</th>
                      <th className="text-right">Jumlah Item</th>
                      <th className="text-right">Total Dicairkan</th>
                      <th>Status</th>
                      <th className="col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {disbursements.map((d) => {
                      const txInfo = txStatusLabel(d.status);
                      return (
                        <tr key={d.id}>
                          <td className="col-mono font-semibold">
                            <Link href={`/disbursements/${d.id}`} className="text-primary hover:underline">
                              {d.disbursementNumber}
                            </Link>
                          </td>
                          <td className="text-sm text-muted">{formatDate(d.disbursementDate)}</td>
                          <td className="text-sm">{d.paymentMethod}</td>
                          <td>
                            <span className="font-semibold text-slate-900">
                              {d.cashAccount.accountName}
                            </span>
                            <span className="text-xs text-muted ml-1">
                              ({d.cashAccount.accountCode})
                            </span>
                          </td>
                          <td className="text-right text-sm">
                            {d._count.items} item
                          </td>
                          <td className="col-num font-semibold text-slate-900" style={{ fontSize: "0.9rem" }}>
                            {formatRupiah(Number(d.totalRealizedAmount))}
                          </td>
                          <td>
                            <span className={`status ${txInfo.className}`}>
                              <span className="status-dot" />
                              {txInfo.label}
                            </span>
                          </td>
                          <td className="col-actions">
                            <Link
                              href={`/disbursements/${d.id}`}
                              className="btn btn-ghost btn-sm"
                            >
                              Detail →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
