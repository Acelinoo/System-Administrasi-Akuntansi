import { getJournalList } from "../actions/journal.actions";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";

export default async function JournalListPage() {
  const journals = await getJournalList();

  const postedJournals = journals.filter((j) => j.status === "POSTED");
  const totalDebit = postedJournals.reduce(
    (sum, j) => sum + j.lines.reduce((ls, l) => ls + Number(l.debit), 0),
    0
  );
  const totalCredit = postedJournals.reduce(
    (sum, j) => sum + j.lines.reduce((ls, l) => ls + Number(l.credit), 0),
    0
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Buku Jurnal Akuntansi</h1>
          <div className="page-header-subtitle">
            Ayat jurnal pembukuan double-entry yang digenerate otomatis dari transaksi operasional proyek
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Summary Cards */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Total Debit (Posted)</div>
              <div className="stat-value">{formatRupiah(totalDebit)}</div>
            </div>
            <div className="stat-sub">Sisi aktiva / beban terposting</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Total Kredit (Posted)</div>
              <div className="stat-value">{formatRupiah(totalCredit)}</div>
            </div>
            <div className="stat-sub">Sisi kas / kewajiban terposting</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Keseimbangan (Balance)</div>
              <div className="stat-value positive">
                {totalDebit === totalCredit ? "SEIMBANG (0)" : formatRupiah(Math.abs(totalDebit - totalCredit))}
              </div>
            </div>
            <div className="stat-sub">
              {totalDebit === totalCredit ? "✓ Debit = Kredit (Balanced)" : "Terdapat selisih pembukuan"}
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Total Entri Jurnal</div>
              <div className="stat-value">{journals.length}</div>
            </div>
            <div className="stat-sub">{postedJournals.length} posted • {journals.length - postedJournals.length} void</div>
          </div>
        </div>

        {/* Journal Entries List */}
        {journals.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📒</div>
              <div className="empty-state-title">Belum ada jurnal tercatat</div>
              <div className="empty-state-desc">
                Jurnal akan dibuat otomatis saat ada transaksi penerimaan dana atau pencairan voucher posted.
              </div>
            </div>
          </div>
        ) : (
          journals.map((journal) => {
            const txInfo = txStatusLabel(journal.status);
            const jDebit = journal.lines.reduce((s, l) => s + Number(l.debit), 0);
            const jCredit = journal.lines.reduce((s, l) => s + Number(l.credit), 0);

            return (
              <div className="card mb-4" key={journal.id}>
                <div className="card-header">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-mono text-slate-900" style={{ fontSize: "0.85rem" }}>
                      {journal.journalNumber}
                    </span>
                    <span className="text-sm text-muted">
                      {formatDate(journal.entryDate)}
                    </span>
                    <span className={`status ${txInfo.className}`}>
                      <span className="status-dot" />
                      {txInfo.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted font-medium bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    {journal.sourceType}
                  </span>
                </div>
                <div className="card-body-flush">
                  <div className="text-xs text-secondary bg-slate-50" style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <strong>Keterangan:</strong> {journal.description}
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kode Akun</th>
                        <th>Nama Akun COA</th>
                        <th>Proyek</th>
                        <th>Memo</th>
                        <th className="text-right">Debit</th>
                        <th className="text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journal.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="col-mono text-xs">{line.coa.accountCode}</td>
                          <td className="text-sm font-medium text-slate-800">{line.coa.accountName}</td>
                          <td className="text-sm">
                            {line.project ? (
                              <span className="font-semibold text-slate-900">{line.project.code}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="text-sm text-muted truncate" style={{ maxWidth: 220 }}>
                            {line.memo || "-"}
                          </td>
                          <td className="col-num font-semibold">
                            {Number(line.debit) > 0 ? formatRupiah(Number(line.debit)) : "-"}
                          </td>
                          <td className="col-num font-semibold">
                            {Number(line.credit) > 0 ? formatRupiah(Number(line.credit)) : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: "var(--slate-50)", fontWeight: 600 }}>
                        <td colSpan={4} className="text-right text-xs text-secondary">
                          TOTAL:
                        </td>
                        <td className="col-num text-slate-900">{formatRupiah(jDebit)}</td>
                        <td className="col-num text-slate-900">{formatRupiah(jCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {journal.status === "VOID" && journal.voidReason && (
                  <div style={{ padding: "8px 16px", background: "var(--red-50)", borderTop: "1px solid var(--red-100)" }}>
                    <span className="text-xs text-red-700">
                      <strong>Dibatalkan (VOID):</strong> {journal.voidReason}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
