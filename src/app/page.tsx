import Link from "next/link";
import { getDashboardStats } from "./actions/acc.actions";
import { getCashBalances } from "./actions/disbursement.actions";
import { formatRupiah, formatDate, accStatusLabel, txStatusLabel } from "@/lib/utils/format";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const balances = await getCashBalances();

  return (
    <>
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1>Dashboard Administrasi</h1>
            <span
              className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ background: "#dcfce7", color: "#15803d" }}
            >
              REAL DATA ONLY
            </span>
          </div>
          <div className="page-header-subtitle">
            Ringkasan posisi keuangan, alokasi ACC, realisasi pencairan, dan likuiditas kas operasional proyek
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/acc/new" className="btn btn-primary btn-sm">
            ➕ Input ACC Baru
          </Link>
          <Link href="/disbursements/new" className="btn btn-secondary btn-sm">
            💸 Pencairan Baru
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* 1. FINANCIAL SUMMARY METRICS (STEP 3 REQUIRED) */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Total Pengajuan (ACC)</div>
            <div className="stat-value font-semibold">
              {formatRupiah(stats.totalAccAmount)}
            </div>
            <div className="stat-sub">{stats.totalAccItems} item dari {stats.totalBatches} batch</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Realisasi (Pencairan)</div>
            <div className="stat-value danger font-semibold">
              {formatRupiah(stats.totalRealizedAmount)}
            </div>
            <div className="stat-sub">
              {stats.totalAccAmount > 0
                ? `${((stats.totalRealizedAmount / stats.totalAccAmount) * 100).toFixed(1)}% telah dicairkan`
                : "Pengeluaran voucher (posted)"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Sisa Outstanding</div>
            <div
              className="stat-value font-semibold"
              style={{
                color: stats.totalOutstandingAmount > 0 ? "var(--color-warning)" : "var(--color-success)",
              }}
            >
              {formatRupiah(stats.totalOutstandingAmount)}
            </div>
            <div className="stat-sub">Kewajiban ACC belum dicairkan</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Dana Masuk (Inflow)</div>
            <div className="stat-value positive font-semibold">
              {formatRupiah(stats.totalInflow)}
            </div>
            <div className="stat-sub">Drop dana atasan/manajemen (posted)</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Saldo Kas & Bank (Likuiditas)</div>
            <div
              className="stat-value font-semibold"
              style={{
                color: balances.totalLiquidity >= 0 ? "var(--color-success)" : "var(--color-danger)",
              }}
            >
              {formatRupiah(balances.totalLiquidity)}
            </div>
            <div className="stat-sub">Total saldo aktif seluruh rekening</div>
          </div>
        </div>

        {/* 2. STATUS BREAKDOWN & CASH ACCOUNTS */}
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-header">
              <h2>Status Pengajuan ACC</h2>
              <span className="text-sm text-secondary">
                {stats.totalAccItems} item total
              </span>
            </div>
            <div className="card-body">
              <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ padding: "12px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div className="stat-label">Approved</div>
                  <div className="stat-value" style={{ color: "var(--blue-600)", fontSize: "1.5rem" }}>
                    {stats.approvedItems}
                  </div>
                  <div className="stat-sub">Belum dicairkan</div>
                </div>
                <div style={{ padding: "12px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div className="stat-label">Sebagian Cair</div>
                  <div className="stat-value warning" style={{ fontSize: "1.5rem" }}>
                    {stats.partialItems}
                  </div>
                  <div className="stat-sub">Realisasi bertahap</div>
                </div>
                <div style={{ padding: "12px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div className="stat-label">Lunas</div>
                  <div className="stat-value positive" style={{ fontSize: "1.5rem" }}>
                    {stats.realizedItems}
                  </div>
                  <div className="stat-sub">Selesai dicairkan</div>
                </div>
                <div style={{ padding: "12px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)" }}>
                  <div className="stat-label">Batal</div>
                  <div className="stat-value text-muted" style={{ fontSize: "1.5rem" }}>
                    {stats.cancelledItems}
                  </div>
                  <div className="stat-sub">Dibatalkan</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Saldo Akun Kas & Bank</h2>
              <Link href="/master/accounts" className="text-xs text-primary font-medium">
                Kelola Akun →
              </Link>
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
                          <span className="font-medium">{acc.accountName}</span>
                          <br />
                          <span className="text-xs text-muted text-mono">
                            {acc.accountCode}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs status status-info" style={{ padding: "2px 8px" }}>
                            {acc.accountType}
                          </span>
                        </td>
                        <td className="col-num">
                          <span
                            className={acc.currentBalance >= 0 ? "positive" : "danger"}
                            style={{ fontWeight: 600 }}
                          >
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

        {/* 3. MONITORING: ACC TERBARU & REALISASI TERBARU */}
        <div className="grid-2 mb-6">
          {/* ACC TERBARU */}
          <div className="card">
            <div className="card-header">
              <h2>Pengajuan ACC Terbaru</h2>
              <Link href="/acc" className="text-xs text-primary font-medium">
                Lihat Semua ACC →
              </Link>
            </div>
            <div className="card-body-flush">
              {stats.recentAccItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">Belum ada data pengajuan ACC</div>
                  <div className="empty-state-desc">Data pengajuan yang diinput akan muncul di sini.</div>
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
                            <td className="col-mono font-medium">
                              <Link href={`/acc/${item.id}`} className="text-primary hover:underline">
                                {item.noKas}
                              </Link>
                            </td>
                            <td className="text-xs">{formatDate(item.accDate)}</td>
                            <td>
                              <span className="font-medium">{item.projectCode}</span>
                            </td>
                            <td className="text-xs">{item.picName}</td>
                            <td className="col-num font-medium">
                              {formatRupiah(item.approvedAmount)}
                            </td>
                            <td>
                              <span className={`status ${statusInfo.className}`} style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
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
              <Link href="/disbursements" className="text-xs text-primary font-medium">
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
                            <td className="col-mono font-medium">
                              <Link href={`/disbursements/${d.id}`} className="text-primary hover:underline">
                                {d.disbursementNumber}
                              </Link>
                            </td>
                            <td className="text-xs">{formatDate(d.disbursementDate)}</td>
                            <td className="text-xs">{d.accountName}</td>
                            <td className="text-xs">{d.paymentMethod}</td>
                            <td className="col-num font-semibold">
                              {formatRupiah(d.totalRealizedAmount)}
                            </td>
                            <td>
                              <span className={`status ${txInfo.className}`} style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
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
                Daftar pengajuan ACC aktif dengan sisa kewajiban pencairan tertinggi yang belum terealisasi penuh
              </div>
            </div>
            <Link href="/reports/acc" className="text-xs text-primary font-medium">
              Buka Rekap ACC →
            </Link>
          </div>
          <div className="card-body-flush">
            {stats.topOutstandingItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✨</div>
                <div className="empty-state-title">Tidak ada outstanding tertunda</div>
                <div className="empty-state-desc">Seluruh pengajuan ACC yang disetujui telah dicairkan penuh.</div>
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
                          <td className="col-mono font-medium">
                            <Link href={`/acc/${item.id}`} className="text-primary hover:underline">
                              {item.noKas}
                            </Link>
                          </td>
                          <td className="font-medium">{item.projectCode}</td>
                          <td>{item.picName}</td>
                          <td className="text-sm truncate" style={{ maxWidth: 260 }}>
                            {item.description}
                          </td>
                          <td className="col-num">{formatRupiah(item.approvedAmount)}</td>
                          <td className="col-num text-primary">{formatRupiah(item.realizedAmount)}</td>
                          <td className="col-num warning font-semibold">
                            {formatRupiah(item.outstandingAmount)}
                          </td>
                          <td>
                            <span className={`status ${statusInfo.className}`} style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="col-actions">
                            <Link
                              href="/disbursements/new"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: "0.75rem", padding: "3px 8px" }}
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

