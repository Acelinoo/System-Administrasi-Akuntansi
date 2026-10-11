import { getCashReport } from "@/lib/reports/cash-report.service";
import { formatRupiah } from "@/lib/utils/format";
import ExportButtons from "../ExportButtons";

export const dynamic = "force-dynamic";

export default async function CashReportPage({
  searchParams,
}: {
  searchParams?: Promise<{
    scope?: string;
    dataScope?: string;
  }>;
}) {
  const params = await searchParams;
  const isTest = params?.scope === "TEST" || params?.dataScope === "TEST";
  const data = await getCashReport({ dataScope: isTest ? "TEST" : "REAL" });

  const isReconciled =
    data.totals.totalOpening + data.totals.totalInflow - data.totals.totalDisbursement ===
    data.totals.totalCurrentBalance;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 className="text-base font-semibold">Laporan Posisi Saldo Kas & Bank</h2>
            {isTest && (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: "1px solid #fcd34d",
                }}
              >
                TEST MODE
              </span>
            )}
          </div>
          <div className="text-xs text-muted">
            Mutasi dan rekonsiliasi saldo real-time akun kas fisik dan rekening bank operasional
          </div>
        </div>
        <ExportButtons reportType="cash" />
      </div>

      {/* RINGKASAN ARUS KAS OPERASIONAL & REKONSILIASI */}
      <div
        className="card mb-6"
        style={{
          background: "var(--slate-50)",
          border: "1px solid var(--slate-200)",
        }}
      >
        <div className="card-header flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Rekonsiliasi Arus Kas Operasional (Cash Flow Statement)
            </h3>
            <div className="text-xs text-muted">
              Verifikasi rumus saldo deterministik: Saldo Akhir = Saldo Awal + Total Penerimaan (Inflow) - Total Pencairan (Disbursement)
            </div>
          </div>
          <span
            className={`status ${isReconciled ? "status-success" : "status-danger"}`}
            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
          >
            {isReconciled ? "100% RECONCILED (SEIMBANG)" : "SELISIH REKONSILIASI"}
          </span>
        </div>
        <div className="card-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <div className="text-xs text-muted mb-1">1. Saldo Awal Likuiditas</div>
              <div className="text-base font-bold text-slate-800">
                {formatRupiah(data.totals.totalOpening)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">2. Arus Kas Masuk (Penerimaan)</div>
              <div className="text-base font-bold" style={{ color: "var(--color-success)" }}>
                +{formatRupiah(data.totals.totalInflow)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">3. Arus Kas Keluar (Pencairan)</div>
              <div className="text-base font-bold" style={{ color: "var(--color-danger)" }}>
                -{formatRupiah(data.totals.totalDisbursement)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">4. Arus Kas Bersih (Net Flow)</div>
              <div
                className="text-base font-bold"
                style={{
                  color:
                    data.totals.totalInflow - data.totals.totalDisbursement >= 0
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                }}
              >
                {formatRupiah(data.totals.totalInflow - data.totals.totalDisbursement)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">5. Saldo Akhir Likuiditas</div>
              <div className="text-base font-bold text-primary">
                {formatRupiah(data.totals.totalCurrentBalance)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Saldo Awal</div>
          <div className="stat-value">{formatRupiah(data.totals.totalOpening)}</div>
          <div className="stat-sub">{data.accounts.length} akun terdaftar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Inflow (Penerimaan)</div>
          <div className="stat-value text-primary font-semibold">
            +{formatRupiah(data.totals.totalInflow)}
          </div>
          <div className="stat-sub">Dropping dana masuk</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Pencairan (Keluar)</div>
          <div className="stat-value font-semibold" style={{ color: "var(--color-danger)" }}>
            -{formatRupiah(data.totals.totalDisbursement)}
          </div>
          <div className="stat-sub">Realisasi voucher belanja</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Saldo Kas Real-Time</div>
          <div
            className="stat-value font-semibold"
            style={{
              color: data.totals.totalCurrentBalance >= 0 ? "var(--color-success)" : "var(--color-danger)",
            }}
          >
            {formatRupiah(data.totals.totalCurrentBalance)}
          </div>
          <div className="stat-sub">Saldo aktif saat ini</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          {data.accounts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏦</div>
              <div className="empty-state-title">Belum ada akun kas/bank terdaftar.</div>
              <div className="empty-state-desc">
                Tambahkan akun kas dan rekening bank melalui menu Master Data Kas & Bank.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Akun Kas / Bank</th>
                    <th className="text-center">Tipe</th>
                    <th>Informasi Rekening</th>
                    <th className="text-right">Saldo Awal</th>
                    <th className="text-right">Inflow (Masuk)</th>
                    <th className="text-right">Pencairan (Keluar)</th>
                    <th className="text-right">Saldo Akhir Real-Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="col-mono font-medium">{acc.accountCode}</td>
                      <td className="font-semibold">{acc.accountName}</td>
                      <td className="text-center">
                        <span
                          className={`status ${acc.accountType === "BANK" ? "status-info" : "status-warning"}`}
                          style={{ fontSize: "0.72rem", padding: "1px 6px" }}
                        >
                          {acc.accountType === "BANK" ? "🏦 BANK" : "💵 CASH"}
                        </span>
                      </td>
                      <td className="text-sm">
                        {acc.bankName ? (
                          <div>
                            <span className="font-medium">{acc.bankName}</span>{" "}
                            <span className="col-mono text-muted">{acc.accountNumber}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">Kas fisik operasional</span>
                        )}
                      </td>
                      <td className="col-num">{formatRupiah(acc.openingBalance)}</td>
                      <td className="col-num text-primary font-medium">
                        +{formatRupiah(acc.totalInflow)}
                      </td>
                      <td className="col-num font-medium" style={{ color: "var(--color-danger)" }}>
                        -{formatRupiah(acc.totalDisbursement)}
                      </td>
                      <td className="col-num font-bold">
                        <span
                          style={{
                            color: acc.currentBalance >= 0 ? "var(--color-success)" : "var(--color-danger)",
                          }}
                        >
                          {formatRupiah(acc.currentBalance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bg-subtle)", fontWeight: "bold" }}>
                    <td colSpan={4} className="text-right">TOTAL KESELURUHAN:</td>
                    <td className="col-num">{formatRupiah(data.totals.totalOpening)}</td>
                    <td className="col-num text-primary">+{formatRupiah(data.totals.totalInflow)}</td>
                    <td className="col-num" style={{ color: "var(--color-danger)" }}>
                      -{formatRupiah(data.totals.totalDisbursement)}
                    </td>
                    <td className="col-num" style={{ color: data.totals.totalCurrentBalance >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                      {formatRupiah(data.totals.totalCurrentBalance)}
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
