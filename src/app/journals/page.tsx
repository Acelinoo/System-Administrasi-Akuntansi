import { getJournalList } from "../actions/journal.actions";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";

export default async function JournalListPage() {
  const journals = await getJournalList();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Jurnal Akuntansi</h1>
          <div className="page-header-subtitle">
            {journals.length} jurnal tercatat — Jurnal digenerate otomatis dari transaksi
          </div>
        </div>
      </div>

      <div className="page-body">
        {journals.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📒</div>
              <div className="empty-state-title">Belum ada jurnal</div>
              <div className="empty-state-desc">
                Jurnal akan dibuat otomatis saat ada penerimaan dana atau pencairan.
              </div>
            </div>
          </div>
        ) : (
          journals.map((journal) => {
            const txInfo = txStatusLabel(journal.status);
            const totalDebit = journal.lines.reduce(
              (s, l) => s + Number(l.debit),
              0
            );
            const totalCredit = journal.lines.reduce(
              (s, l) => s + Number(l.credit),
              0
            );

            return (
              <div className="card mb-4" key={journal.id}>
                <div className="card-header">
                  <div>
                    <span className="font-semibold text-mono" style={{ fontSize: "0.85rem" }}>
                      {journal.journalNumber}
                    </span>
                    <span className="text-sm text-secondary" style={{ marginLeft: 12 }}>
                      {formatDate(journal.entryDate)}
                    </span>
                    <span className={`status ${txInfo.className}`} style={{ marginLeft: 12 }}>
                      <span className="status-dot"></span>
                      {txInfo.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {journal.sourceType}
                  </span>
                </div>
                <div className="card-body-flush">
                  <div className="text-sm text-secondary" style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--gray-100)" }}>
                    {journal.description}
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kode Akun</th>
                        <th>Nama Akun</th>
                        <th>Proyek</th>
                        <th>Memo</th>
                        <th className="text-right">Debit</th>
                        <th className="text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journal.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="col-mono">{line.coa.accountCode}</td>
                          <td className="text-sm">{line.coa.accountName}</td>
                          <td className="text-sm">
                            {line.project ? line.project.code : "-"}
                          </td>
                          <td className="text-sm text-muted truncate" style={{ maxWidth: 200 }}>
                            {line.memo || "-"}
                          </td>
                          <td className="col-num">
                            {Number(line.debit) > 0 ? formatRupiah(Number(line.debit)) : "-"}
                          </td>
                          <td className="col-num">
                            {Number(line.credit) > 0 ? formatRupiah(Number(line.credit)) : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid var(--gray-300)", fontWeight: 700 }}>
                        <td colSpan={4} className="text-right text-xs text-secondary">
                          TOTAL
                        </td>
                        <td className="col-num">{formatRupiah(totalDebit)}</td>
                        <td className="col-num">{formatRupiah(totalCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {journal.status === "VOID" && journal.voidReason && (
                  <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--red-50)", borderTop: "1px solid var(--red-100)" }}>
                    <span className="text-xs" style={{ color: "var(--red-700)" }}>
                      <strong>VOID:</strong> {journal.voidReason}
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
