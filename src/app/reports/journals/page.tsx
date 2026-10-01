import { getJournalReport } from "@/lib/reports/journal-report.service";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import ExportButtons from "../ExportButtons";
import ReportFilterBar from "../ReportFilterBar";

export default async function JournalReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    sourceType?: string;
    status?: string;
    coaId?: string;
  }>;
}) {
  const params = await searchParams;
  const [data, coaList] = await Promise.all([
    getJournalReport(params),
    prisma.coaAccount.findMany({ where: { isActive: true }, select: { id: true, accountCode: true, accountName: true } }),
  ]);

  const filterConfig = {
    showDates: true,
    sourceTypes: [
      { value: "FUND_INFLOW", label: "Penerimaan Dana (Inflow)" },
      { value: "DISBURSEMENT", label: "Pencairan (Disbursement)" },
      { value: "ACC_SUBMISSION", label: "Pengajuan ACC" },
      { value: "MANUAL", label: "Manual" },
    ],
    statuses: [
      { value: "POSTED", label: "POSTED (Aktif)" },
      { value: "VOID", label: "VOID (Dibatalkan)" },
    ],
    accounts: coaList.map((c) => ({ id: c.id, name: `${c.accountCode} - ${c.accountName}` })),
  };

  const isBalanced = data.totals.totalDebit === data.totals.totalCredit;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Laporan Buku Jurnal Umum (Double-Entry)</h2>
          <div className="text-xs text-muted">
            Ayat jurnal transaksi double-entry yang digenerate otomatis dari mutasi penerimaan dan pengeluaran
          </div>
        </div>
        <ExportButtons reportType="journal" />
      </div>

      <ReportFilterBar config={filterConfig} />

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Debit (POSTED)</div>
          <div className="stat-value font-semibold text-primary">
            {formatRupiah(data.totals.totalDebit)}
          </div>
          <div className="stat-sub">{data.totals.entryCount} baris jurnal</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Kredit (POSTED)</div>
          <div className="stat-value font-semibold" style={{ color: "var(--color-success)" }}>
            {formatRupiah(data.totals.totalCredit)}
          </div>
          <div className="stat-sub">Sisi kredit transaksi aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Keseimbangan Akuntansi</div>
          <div className="stat-value">
            {isBalanced ? (
              <span style={{ color: "var(--color-success)" }}>SEIMBANG (BALANCED)</span>
            ) : (
              <span style={{ color: "var(--color-danger)" }}>SELISIH (UNBALANCED)</span>
            )}
          </div>
          <div className="stat-sub">
            {isBalanced ? "Debit sama dengan Kredit" : "Peringatan: Terdapat selisih saldo"}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          {data.rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📒</div>
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
                    <th>No. Jurnal</th>
                    <th>Sumber</th>
                    <th>Keterangan / Memo</th>
                    <th>Kode Akun</th>
                    <th>Nama Akun (COA)</th>
                    <th className="text-right">Debit (Rp)</th>
                    <th className="text-right">Kredit (Rp)</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const txInfo = txStatusLabel(row.status);
                    return (
                      <tr key={row.lineId}>
                        <td className="text-sm">{formatDate(row.entryDate)}</td>
                        <td className="col-mono font-medium">{row.journalNumber}</td>
                        <td>
                          <span className="status status-neutral" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                            {row.sourceType}
                          </span>
                        </td>
                        <td className="truncate" style={{ maxWidth: 240 }}>
                          {row.memo || row.description}
                        </td>
                        <td className="col-mono font-medium">{row.accountCode}</td>
                        <td className="text-sm">{row.accountName}</td>
                        <td className="col-num font-medium">
                          {row.debit > 0 ? formatRupiah(row.debit) : "-"}
                        </td>
                        <td className="col-num font-medium">
                          {row.credit > 0 ? formatRupiah(row.credit) : "-"}
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
                    <td colSpan={6} className="text-right">
                      TOTAL (POSTED ONLY):
                    </td>
                    <td className="col-num text-primary">{formatRupiah(data.totals.totalDebit)}</td>
                    <td className="col-num" style={{ color: "var(--color-success)" }}>
                      {formatRupiah(data.totals.totalCredit)}
                    </td>
                    <td className="text-center">
                      <span
                        className={`status ${isBalanced ? "status-success" : "status-danger"}`}
                        style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      >
                        {isBalanced ? "BALANCED" : "UNBALANCED"}
                      </span>
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
