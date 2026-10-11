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
    projectId?: string;
    scope?: string;
    dataScope?: string;
  }>;
}) {
  const params = await searchParams;
  const isTest = params.scope === "TEST" || params.dataScope === "TEST";
  const [data, coaList, projectsList] = await Promise.all([
    getJournalReport(params),
    prisma.coaAccount.findMany({ where: { isActive: true }, select: { id: true, accountCode: true, accountName: true }, orderBy: { accountCode: "asc" } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  const filterConfig = {
    showDates: true,
    projects: projectsList.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` })),
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

  const activeRows = data.rows.filter((r) => r.status === "POSTED");
  const projectExpenses = activeRows
    .filter((r) => r.accountCode.startsWith("5"))
    .reduce((s, r) => s + r.debit - r.credit, 0);
  const overheadExpenses = activeRows
    .filter((r) => r.accountCode.startsWith("6"))
    .reduce((s, r) => s + r.debit - r.credit, 0);
  const totalExpenses = projectExpenses + overheadExpenses;
  const equityInflows = activeRows
    .filter((r) => r.accountCode.startsWith("3"))
    .reduce((s, r) => s + r.credit - r.debit, 0);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 className="text-base font-semibold">Laporan Buku Jurnal Umum & Proyek (Double-Entry)</h2>
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
            Ayat jurnal transaksi double-entry yang digenerate otomatis dari mutasi penerimaan dan pengeluaran proyek maupun umum
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

      {/* RINGKASAN REKAPITULASI BEBAN & POSISI AKUN (COA SUMMARY) */}
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
              Ringkasan Beban & Posisi Akun Jurnal (COA Summary)
            </h3>
            <div className="text-xs text-muted">
              Klasifikasi ayat jurnal posted berdasarkan klasifikasi bagan akun (COA)
            </div>
          </div>
          <span className="text-xs text-muted">
            {activeRows.length} baris posted aktif
          </span>
        </div>
        <div className="card-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <div className="text-xs text-muted mb-1">Total Beban Pokok Proyek (5xxx)</div>
              <div className="text-base font-bold text-slate-800">
                {formatRupiah(projectExpenses)}
              </div>
              <div className="text-xs text-muted mt-0.5">Upah, Material, Subkon, Sewa Alat</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Total Beban Operasional Umum (6xxx)</div>
              <div className="text-base font-bold text-slate-800">
                {formatRupiah(overheadExpenses)}
              </div>
              <div className="text-xs text-muted mt-0.5">Operasional & Administrasi Umum</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Total Akumulasi Beban (5xxx + 6xxx)</div>
              <div className="text-base font-bold" style={{ color: "var(--color-danger)" }}>
                {formatRupiah(totalExpenses)}
              </div>
              <div className="text-xs text-muted mt-0.5">Total realisasi belanja dibukukan</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Dropping Modal / Ekuitas (3xxx)</div>
              <div className="text-base font-bold text-emerald-600">
                {formatRupiah(equityInflows)}
              </div>
              <div className="text-xs text-muted mt-0.5">Drop dana atasan/manajemen posted</div>
            </div>
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
                    <th>Proyek</th>
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
                        <td>
                          {row.projectCode ? (
                            <span className="font-semibold text-primary text-xs">{row.projectCode}</span>
                          ) : (
                            <span className="text-muted text-xs">Umum</span>
                          )}
                        </td>
                        <td className="truncate" style={{ maxWidth: 220 }}>
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
                    <td colSpan={7} className="text-right">
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
