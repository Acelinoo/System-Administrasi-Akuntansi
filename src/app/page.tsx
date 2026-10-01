import Link from "next/link";
import { getDashboardStats } from "./actions/acc.actions";
import { getCashBalances } from "./actions/disbursement.actions";
import { formatRupiah, formatDate, accStatusLabel, txStatusLabel } from "@/lib/utils/format";
import { PlusIcon, DisbursementIcon } from "./components/Icons";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const balances = await getCashBalances();

  const pctRealized =
    stats.totalAccAmount > 0
      ? ((stats.totalRealizedAmount / stats.totalAccAmount) * 100).toFixed(1)
      : "0.0";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="page-header-subtitle">
            Ringkasan administrasi proyek dan keuangan
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/acc/new" className="btn btn-primary btn-sm">
            <PlusIcon size={14} />
            <span>Input Data ACC</span>
          </Link>
          <Link href="/disbursements/new" className="btn btn-secondary btn-sm">
            <DisbursementIcon size={14} />
            <span>Pencairan Baru</span>
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* 1. FINANCIAL SUMMARY METRICS (MONETIRA 4-CARD HERO HIERARCHY) */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Total Data ACC</div>
              <div className="stat-value primary">{formatRupiah(stats.totalAccAmount)}</div>
            </div>
            <div className="stat-sub">{stats.totalAccItems} item • {stats.totalBatches} batch terdaftar</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Total Dana Masuk</div>
              <div className="stat-value positive">{formatRupiah(stats.totalInflow)}</div>
            </div>
            <div className="stat-sub">Drop dana atasan/manajemen (posted)</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Total Realisasi</div>
              <div className="stat-value">{formatRupiah(stats.totalRealizedAmount)}</div>
            </div>
            <div className="stat-sub">{pctRealized}% dari total alokasi ACC</div>
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
        </div>

        {/* 2. OVERVIEW ROW: STATUS ALOKASI ACC + SALDO KAS & BANK */}
        <div className="grid-2 mb-6">
          {/* Status Alokasi Card */}
          <div className="card">
            <div className="card-header">
              <h2>Status Alokasi ACC</h2>
              <span className="text-xs text-muted font-medium">{stats.totalAccItems} item transaksi</span>
            </div>
            <div className="card-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ background: "var(--slate-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--slate-100)" }}>
                  <div className="text-xs text-muted font-medium mb-1">Approved</div>
                  <div className="text-xl font-bold" style={{ color: "var(--blue-600)" }}>{stats.approvedItems}</div>
                  <div className="text-xs text-muted mt-1">Belum cair</div>
                </div>
                <div style={{ background: "var(--slate-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--slate-100)" }}>
                  <div className="text-xs text-muted font-medium mb-1">Sebagian</div>
                  <div className="text-xl font-bold" style={{ color: "var(--amber-600)" }}>{stats.partialItems}</div>
                  <div className="text-xs text-muted mt-1">Bertahap</div>
                </div>
                <div style={{ background: "var(--slate-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--slate-100)" }}>
                  <div className="text-xs text-muted font-medium mb-1">Lunas</div>
                  <div className="text-xl font-bold" style={{ color: "var(--green-600)" }}>{stats.realizedItems}</div>
                  <div className="text-xs text-muted mt-1">Selesai</div>
                </div>
                <div style={{ background: "var(--slate-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--slate-100)" }}>
                  <div className="text-xs text-muted font-medium mb-1">Batal</div>
                  <div className="text-xl font-bold" style={{ color: "var(--slate-400)" }}>{stats.cancelledItems}</div>
                  <div className="text-xs text-muted mt-1">Dibatalkan</div>
                </div>
              </div>

              {/* Restrained Allocation Progress Bar */}
              <div style={{ height: 6, background: "var(--slate-100)", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                <div
                  style={{
                    width: `${stats.totalAccItems > 0 ? (stats.realizedItems / stats.totalAccItems) * 100 : 0}%`,
                    background: "var(--green-600)",
                  }}
                  title={`Lunas: ${stats.realizedItems}`}
                />
                <div
                  style={{
                    width: `${stats.totalAccItems > 0 ? (stats.partialItems / stats.totalAccItems) * 100 : 0}%`,
                    background: "var(--amber-500)",
                  }}
                  title={`Sebagian: ${stats.partialItems}`}
                />
                <div
                  style={{
                    width: `${stats.totalAccItems > 0 ? (stats.approvedItems / stats.totalAccItems) * 100 : 0}%`,
                    background: "var(--blue-500)",
                  }}
                  title={`Approved: ${stats.approvedItems}`}
                />
              </div>
            </div>
          </div>

          {/* Saldo Kas & Bank Card */}
          <div className="card">
            <div className="card-header">
              <h2>Saldo Akun Kas & Bank</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-secondary">
                  Likuiditas: <strong className="tabular-nums" style={{ color: balances.totalLiquidity >= 0 ? "var(--green-700)" : "var(--red-600)" }}>{formatRupiah(balances.totalLiquidity)}</strong>
                </span>
                <Link href="/master/accounts" className="text-xs text-primary font-medium hover:underline ml-2">
                  Kelola →
                </Link>
              </div>
            </div>
            <div className="card-body-flush">
              {balances.accounts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏦</div>
                  <div className="empty-state-title">Belum ada akun kas/bank</div>
                  <div className="empty-state-desc">Tambahkan akun melalui menu Master Kas & Bank.</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Akun</th>
                      <th>Tipe</th>
                      <th className="text-right">Saldo Saat Ini</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.accounts.map((acc) => (
                      <tr key={acc.accountId}>
                        <td>
                          <div className="font-semibold text-slate-900">{acc.accountName}</div>
                          <div className="text-xs text-muted text-mono">{acc.accountCode}</div>
                        </td>
                        <td>
                          <span className="status status-info">{acc.accountType}</span>
                        </td>
                        <td className="col-num font-semibold">
                          <span className={acc.currentBalance >= 0 ? "text-slate-900" : "danger"}>
                            {formatRupiah(acc.currentBalance)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* 3. MONITORING TABLES ROW: DATA ACC TERBARU & REALISASI TERBARU */}
        <div className="grid-2 mb-6">
          {/* DATA ACC TERBARU */}
          <div className="card">
            <div className="card-header">
              <h2>Data ACC Terbaru</h2>
              <Link href="/acc" className="text-xs text-primary font-medium hover:underline">
                Lihat Semua ACC →
              </Link>
            </div>
            <div className="card-body-flush">
              {stats.recentAccItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">Belum ada data ACC</div>
                  <div className="empty-state-desc">Data ACC yang dicatat akan muncul di sini.</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No Kas</th>
                        <th>Tanggal</th>
                        <th>Proyek</th>
                        <th>PIC</th>
                        <th className="text-right">Nominal ACC</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentAccItems.map((item) => {
                        const statusInfo = accStatusLabel(item.status);
                        return (
                          <tr key={item.id}>
                            <td className="col-mono">
                              <Link href={`/acc/${item.id}`} className="text-primary hover:underline font-semibold">
                                {item.noKas}
                              </Link>
                            </td>
                            <td className="text-xs text-muted">{formatDate(item.accDate)}</td>
                            <td>
                              <span className="font-medium">{item.projectCode}</span>
                            </td>
                            <td className="text-xs text-secondary">{item.picName}</td>
                            <td className="col-num font-semibold">
                              {formatRupiah(item.approvedAmount)}
                            </td>
                            <td>
                              <span className={`status ${statusInfo.className}`}>
                                <span className="status-dot" />
                                {statusInfo.label}
                              </span>
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

          {/* REALISASI TERBARU */}
          <div className="card">
            <div className="card-header">
              <h2>Realisasi Pencairan Terbaru</h2>
              <Link href="/disbursements" className="text-xs text-primary font-medium hover:underline">
                Lihat Semua Pencairan →
              </Link>
            </div>
            <div className="card-body-flush">
              {stats.recentDisbursements.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">💸</div>
                  <div className="empty-state-title">Belum ada realisasi pencairan</div>
                  <div className="empty-state-desc">Pencairan voucher yang dicatatkan akan tampil di sini.</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No. Pencairan</th>
                        <th>Tanggal</th>
                        <th>Akun Pembayar</th>
                        <th>Metode</th>
                        <th className="text-right">Total Dicairkan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentDisbursements.map((d) => {
                        const txInfo = txStatusLabel(d.status);
                        return (
                          <tr key={d.id}>
                            <td className="col-mono">
                              <Link href={`/disbursements/${d.id}`} className="text-primary hover:underline font-semibold">
                                {d.disbursementNumber}
                              </Link>
                            </td>
                            <td className="text-xs text-muted">{formatDate(d.disbursementDate)}</td>
                            <td className="text-xs">{d.accountName}</td>
                            <td className="text-xs text-secondary">{d.paymentMethod}</td>
                            <td className="col-num font-semibold text-slate-900">
                              {formatRupiah(d.totalRealizedAmount)}
                            </td>
                            <td>
                              <span className={`status ${txInfo.className}`}>
                                <span className="status-dot" />
                                {txInfo.label}
                              </span>
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

        {/* 4. MONITORING: OUTSTANDING TERBESAR */}
        <div className="card mb-6">
          <div className="card-header">
            <div>
              <h2>Monitoring Outstanding Terbesar</h2>
              <div className="text-xs text-muted">
                Daftar data ACC aktif dengan sisa kewajiban pencairan tertinggi yang belum terealisasi penuh
              </div>
            </div>
            <Link href="/reports/acc" className="text-xs text-primary font-medium hover:underline">
              Buka Rekap ACC →
            </Link>
          </div>
          <div className="card-body-flush">
            {stats.topOutstandingItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✨</div>
                <div className="empty-state-title">Tidak ada outstanding tertunda</div>
                <div className="empty-state-desc">Seluruh data ACC yang disetujui telah dicairkan penuh.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No Kas</th>
                      <th>Proyek</th>
                      <th>PIC Lapangan</th>
                      <th>Uraian Pengeluaran</th>
                      <th className="text-right">Nominal ACC</th>
                      <th className="text-right">Realisasi</th>
                      <th className="text-right">Sisa Outstanding</th>
                      <th>Status</th>
                      <th className="col-actions">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topOutstandingItems.map((item) => {
                      const statusInfo = accStatusLabel(item.status);
                      return (
                        <tr key={item.id}>
                          <td className="col-mono">
                            <Link href={`/acc/${item.id}`} className="text-primary hover:underline font-semibold">
                              {item.noKas}
                            </Link>
                          </td>
                          <td>
                            <span className="font-semibold text-slate-900">{item.projectCode}</span>
                          </td>
                          <td className="text-xs">{item.picName}</td>
                          <td className="text-sm truncate" style={{ maxWidth: 260 }} title={item.description}>
                            {item.description}
                          </td>
                          <td className="col-num">{formatRupiah(item.approvedAmount)}</td>
                          <td className="col-num text-secondary">{formatRupiah(item.realizedAmount)}</td>
                          <td className="col-num font-semibold" style={{ color: "var(--amber-700)" }}>
                            {formatRupiah(item.outstandingAmount)}
                          </td>
                          <td>
                            <span className={`status ${statusInfo.className}`}>
                              <span className="status-dot" />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="col-actions">
                            <Link
                              href="/disbursements/new"
                              className="btn btn-secondary btn-sm"
                            >
                              Cairkan →
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
