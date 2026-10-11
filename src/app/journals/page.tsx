import { getJournalList } from "../actions/journal.actions";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import Link from "next/link";

export default async function JournalListPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const projectId = params?.projectId;
  const isTest = params?.scope === "TEST";
  const scope = isTest ? "TEST" : "REAL";

  const [journals, allProjects, realCount, testCount] = await Promise.all([
    getJournalList(scope as "REAL" | "TEST", projectId),
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.journalEntry.count({ where: { dataScope: "REAL" } }),
    prisma.journalEntry.count({ where: { dataScope: "TEST" } }),
  ]);

  const activeProject = allProjects.find((p) => p.id === projectId);

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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1>Buku Jurnal Akuntansi</h1>
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
            {activeProject
              ? `Jurnal Proyek: ${activeProject.code} — ${activeProject.name}`
              : isTest
              ? "Lingkungan Terisolasi — Menampilkan ayat jurnal double-entry hasil pengujian manual (dataScope: TEST)."
              : "Ayat jurnal pembukuan double-entry yang digenerate otomatis dari seluruh transaksi proyek dan umum"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <form method="GET" action="/journals" className="flex items-center gap-2">
            {isTest && <input type="hidden" name="scope" value="TEST" />}
            <select
              name="projectId"
              defaultValue={projectId || "ALL"}
              className="form-control"
              style={{ fontSize: "0.85rem", padding: "6px 12px", width: "auto" }}
            >
              <option value="ALL">Semua Proyek & Umum</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  Proyek: {p.code} - {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm">
              Filter
            </button>
            {projectId && (
              <Link href={isTest ? "/journals?scope=TEST" : "/journals"} className="btn btn-secondary btn-sm">
                Reset
              </Link>
            )}
          </form>
        </div>
      </div>

      <div className="page-body">
        {/* Scope Switcher Tabs */}
        <div className="scope-tabs mb-6">
          <Link
            href={projectId && projectId !== "ALL" ? `/journals?projectId=${projectId}` : "/journals"}
            className={`scope-tab ${!isTest ? "active" : ""}`}
            title="Lihat Jurnal Akuntansi Data Operasional Nyata (REAL)"
          >
            <span className="status-indicator-dot online" />
            <span>Data Operasional (REAL)</span>
            <span className="scope-tab-badge">{realCount}</span>
          </Link>
          <Link
            href={projectId && projectId !== "ALL" ? `/journals?scope=TEST&projectId=${projectId}` : "/journals?scope=TEST"}
            className={`scope-tab ${isTest ? "active test-active" : ""}`}
            title="Lihat Jurnal Akuntansi Pengujian UAT (TEST)"
          >
            <span className="status-indicator-dot test" />
            <span>Pengujian UAT (TEST)</span>
            <span className="scope-tab-badge">{testCount}</span>
          </Link>
        </div>

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
              <div className="empty-state-title">
                {!isTest
                  ? "Belum ada jurnal operasional (REAL) tercatat"
                  : "Belum ada jurnal pengujian (TEST) tercatat"}
              </div>
              <div className="empty-state-desc">
                {!isTest
                  ? "Jurnal operasional REAL akan dibuat otomatis saat transaksi penerimaan dana atau pencairan voucher REAL diposting."
                  : "Jurnal pengujian TEST akan dibuat otomatis saat transaksi ber-scope TEST diposting."}
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
                    💡 Ditemukan {testCount} entri jurnal pada mode pengujian (scope=TEST), termasuk voucher pencairan UAT Anda.
                  </p>
                  <Link
                    href={projectId && projectId !== "ALL" ? `/journals?scope=TEST&projectId=${projectId}` : "/journals?scope=TEST"}
                    className="btn btn-sm btn-primary"
                    style={{ background: "#d97706", borderColor: "#b45309" }}
                  >
                    Buka Jurnal Pengujian UAT ({testCount} Jurnal) →
                  </Link>
                </div>
              )}
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
