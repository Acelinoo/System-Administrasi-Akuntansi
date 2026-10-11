import Link from "next/link";
import { getDisbursementList, getDisbursementPageSummary } from "../actions/disbursement.actions";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import { PlusIcon } from "../components/Icons";
import { DataScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export default async function DisbursementListPage({
  searchParams,
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const params = await searchParams;
  const isTest = params?.scope === "TEST";
  const scope = isTest ? DataScope.TEST : DataScope.REAL;

  const [disbursements, stats, realCount, testCount] = await Promise.all([
    getDisbursementList(scope),
    getDisbursementPageSummary(scope),
    prisma.disbursement.count({ where: { dataScope: DataScope.REAL } }),
    prisma.disbursement.count({ where: { dataScope: DataScope.TEST } }),
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1>Realisasi Pencairan</h1>
            {isTest && (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "4px",
                  border: "1px solid #fcd34d",
                  letterSpacing: "0.5px",
                }}
              >
                MODE UJI COBA (dataScope: TEST)
              </span>
            )}
          </div>
          <div className="page-header-subtitle">
            {isTest
              ? "Lingkungan Terisolasi — Menampilkan voucher pencairan hasil pengujian manual (dataScope: TEST)."
              : "Pencatatan realisasi pengeluaran kas proyek berdasarkan data ACC yang telah sah"}
          </div>
        </div>
        <Link href={isTest ? "/disbursements/new?scope=TEST" : "/disbursements/new"} className="btn btn-primary">
          <PlusIcon size={14} />
          <span>Pencairan Baru</span>
        </Link>
      </div>

      <div className="page-body">
        {/* Scope Switcher Tabs */}
        <div className="scope-tabs mb-6">
          <Link
            href="/disbursements"
            className={`scope-tab ${!isTest ? "active" : ""}`}
            title="Lihat Voucher Pencairan Data Operasional Nyata (REAL)"
          >
            <span className="status-indicator-dot online" />
            <span>Data Operasional (REAL)</span>
            <span className="scope-tab-badge">{realCount}</span>
          </Link>
          <Link
            href="/disbursements?scope=TEST"
            className={`scope-tab ${isTest ? "active test-active" : ""}`}
            title="Lihat Voucher Pencairan Pengujian UAT (TEST)"
          >
            <span className="status-indicator-dot test" />
            <span>Pengujian UAT (TEST)</span>
            <span className="scope-tab-badge">{testCount}</span>
          </Link>
        </div>

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
                <div className="empty-state-title">
                  {!isTest ? "Belum ada voucher pencairan operasional (REAL)" : "Belum ada voucher pencairan pengujian (TEST)"}
                </div>
                <div className="empty-state-desc">
                  {!isTest
                    ? "Setelah data ACC dicatatkan, Anda dapat mencatatkan pencairan/realisasinya melalui tombol di atas."
                    : "Pencairan pengujian dengan dataScope=TEST akan tampil di sini."}
                </div>
                {!isTest && testCount > 0 && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: "14px 18px",
                      borderRadius: 8,
                      background: "#fef3c7",
                      border: "1px solid #fde68a",
                      maxWidth: 520,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#92400e",
                        marginBottom: 10,
                        lineHeight: 1.4,
                      }}
                    >
                      💡 Ditemukan {testCount} voucher pencairan pada mode pengujian (scope=TEST).
                    </p>
                    <Link
                      href="/disbursements?scope=TEST"
                      className="btn btn-sm btn-primary"
                      style={{ background: "#d97706", borderColor: "#b45309" }}
                    >
                      Buka Voucher Pencairan UAT ({testCount} Voucher) →
                    </Link>
                  </div>
                )}
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
