import Link from "next/link";
import { getDashboardStats } from "./actions/acc.actions";
import { getCashBalances } from "./actions/disbursement.actions";
import { getProjectReport } from "@/lib/reports/project-report.service";
import { formatRupiah, formatDate, accStatusLabel, txStatusLabel } from "@/lib/utils/format";
import { PlusIcon, DisbursementIcon } from "./components/Icons";
import { PageMotion, StaggerCards } from "./components/GsapMotion";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    scope?: string;
    dataScope?: string;
  }>;
}) {
  const params = await searchParams;
  const isTest = params?.scope === "TEST" || params?.dataScope === "TEST";
  const scope = isTest ? "TEST" : "REAL";

  const [stats, balances, projectReport] = await Promise.all([
    getDashboardStats(scope),
    getCashBalances(scope),
    getProjectReport({ dataScope: scope }),
  ]);

  const pctRealized =
    stats.totalAccAmount > 0
      ? ((stats.totalRealizedAmount / stats.totalAccAmount) * 100).toFixed(1)
      : "0.0";

  return (
    <PageMotion>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1>Dashboard</h1>
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
                MODE PENGUJIAN (dataScope: TEST)
              </span>
            )}
          </div>
          <div className="page-header-subtitle">
            Ringkasan administrasi proyek, keuangan, dan pengendalian biaya operasional
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/acc/new${isTest ? "?scope=TEST" : ""}`} className="btn btn-primary btn-sm">
            <PlusIcon size={14} />
            <span>Input Data ACC</span>
          </Link>
          <Link href={`/disbursements/new${isTest ? "?scope=TEST" : ""}`} className="btn btn-secondary btn-sm">
            <DisbursementIcon size={14} />
            <span>Pencairan Baru</span>
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* 1. FINANCIAL SUMMARY METRICS (MONETIRA 4-CARD HERO HIERARCHY) */}
        <StaggerCards className="stat-grid mb-4">
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
        </StaggerCards>

        {/* 1.5 EXECUTIVE PROJECT & BUDGET KPI CARDS */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Total Nilai Kontrak Proyek</div>
            <div className="stat-value text-slate-900 font-semibold">
              {formatRupiah(projectReport.totals.totalContractValue)}
            </div>
            <div className="stat-sub">{projectReport.totals.projectCount} proyek aktif tercatat</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Pagu RAP (Anggaran)</div>
            <div className="stat-value text-primary font-semibold">
              {formatRupiah(projectReport.totals.totalBudget)}
            </div>
            <div className="stat-sub">
              Sisa Pagu: {formatRupiah(projectReport.totals.totalRemainingBudget)}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Saldo Likuiditas Kas & Bank</div>
            <div
              className="stat-value font-semibold"
              style={{ color: balances.totalLiquidity >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {formatRupiah(balances.totalLiquidity)}
            </div>
            <div className="stat-sub">{balances.accounts.length} akun kas & rekening aktif</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Status Kontrol Biaya Proyek</div>
            <div className="stat-value">
              {projectReport.totals.overBudgetCount > 0 ? (
                <span style={{ color: "var(--color-danger)", fontSize: "1.1rem" }}>
                  {projectReport.totals.overBudgetCount} Overbudget
                </span>
              ) : projectReport.totals.warningBudgetCount > 0 ? (
                <span style={{ color: "var(--color-warning)", fontSize: "1.1rem" }}>
                  {projectReport.totals.warningBudgetCount} Waspada (&ge;90%)
                </span>
              ) : (
                <span style={{ color: "var(--color-success)", fontSize: "1.1rem" }}>
                  Sesuai Pagu (Aman)
                </span>
              )}
            </div>
            <div className="stat-sub">
              {projectReport.totals.healthyBudgetCount} proyek aman • {projectReport.totals.noBudgetCount} belum ada RAP
            </div>
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

        {/* 2.5 PROJECT SUMMARY & COST CONTROL OVERVIEW */}
        <div className="card mb-6">
          <div className="card-header flex justify-between items-center">
            <div>
              <h2>Ringkasan Proyek & Pengendalian Biaya</h2>
              <div className="text-xs text-muted">
                Monitoring nilai kontrak, pagu RAP, realisasi biaya keluar, serta komparasi progres penerimaan vs fisik lapangan
              </div>
            </div>
            <Link href={`/reports/projects${isTest ? "?scope=TEST" : ""}`} className="text-xs text-primary font-medium hover:underline">
              Lihat Seluruh Proyek →
            </Link>
          </div>
          <div className="card-body-flush">
            {/* Executive Cost Alert Banner */}
            {(projectReport.totals.overBudgetCount > 0 || projectReport.totals.warningBudgetCount > 0) && (
              <div
                style={{
                  background: projectReport.totals.overBudgetCount > 0 ? "#fef2f2" : "#fffbeb",
                  borderLeft: `4px solid ${projectReport.totals.overBudgetCount > 0 ? "var(--color-danger)" : "var(--color-warning)"}`,
                  padding: "12px 16px",
                  margin: "12px 16px",
                  borderRadius: "0 6px 6px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.2rem" }}>{projectReport.totals.overBudgetCount > 0 ? "🚨" : "⚠️"}</span>
                  <div>
                    <strong>Peringatan Pengendalian Biaya:</strong> Terdapat{" "}
                    {projectReport.totals.overBudgetCount > 0 && (
                      <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>
                        {projectReport.totals.overBudgetCount} proyek melampaui pagu RAP
                      </span>
                    )}
                    {projectReport.totals.overBudgetCount > 0 && projectReport.totals.warningBudgetCount > 0 && " dan "}
                    {projectReport.totals.warningBudgetCount > 0 && (
                      <span style={{ color: "var(--color-warning)", fontWeight: 700 }}>
                        {projectReport.totals.warningBudgetCount} proyek mendekati batas pagu (&ge;90%)
                      </span>
                    )}
                    . Segera tinjau realisasi belanja pada detail proyek terkait.
                  </div>
                </div>
                <Link
                  href={`/reports/projects${isTest ? "?scope=TEST" : ""}`}
                  className="btn btn-secondary btn-sm"
                  style={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                >
                  Detail Laporan Proyek →
                </Link>
              </div>
            )}

            {projectReport.projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">Belum ada proyek aktif dengan alokasi biaya.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kode Proyek</th>
                      <th>Nama Proyek</th>
                      <th className="text-right">Nilai Kontrak</th>
                      <th className="text-right">Pagu RAP</th>
                      <th className="text-right">Biaya Keluar</th>
                      <th className="text-center">Status Kontrol</th>
                      <th className="text-right">Penerimaan</th>
                      <th className="text-right">Saldo Bersih</th>
                      <th className="text-center">Progres Fisik</th>
                      <th className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectReport.projects.slice(0, 6).map((p) => (
                      <tr key={p.projectId}>
                        <td className="col-mono font-bold">
                          <Link href={`/projects/${p.projectId}${isTest ? "?scope=TEST" : ""}`} className="text-primary hover:underline">
                            {p.projectCode}
                          </Link>
                        </td>
                        <td className="font-medium text-slate-800">{p.projectName}</td>
                        <td className="col-num font-semibold">
                          {p.contractValue !== null ? formatRupiah(p.contractValue) : "-"}
                        </td>
                        <td className="col-num font-medium text-slate-700">
                          {p.totalBudget > 0 ? formatRupiah(p.totalBudget) : "-"}
                        </td>
                        <td className="col-num text-primary font-semibold">
                          {formatRupiah(p.realizedAmount)}
                        </td>
                        <td className="text-center">
                          {p.costVarianceStatus === "OVERBUDGET" ? (
                            <span className="status status-danger font-bold" style={{ fontSize: "0.72rem", padding: "2px 6px" }}>
                              OVER ({p.budgetBurnRatePct?.toFixed(0)}%)
                            </span>
                          ) : p.costVarianceStatus === "WARNING" ? (
                            <span className="status status-warning font-bold" style={{ fontSize: "0.72rem", padding: "2px 6px" }}>
                              WASPADA ({p.budgetBurnRatePct?.toFixed(0)}%)
                            </span>
                          ) : p.costVarianceStatus === "HEALTHY" ? (
                            <span className="status status-success font-medium" style={{ fontSize: "0.72rem", padding: "2px 6px" }}>
                              AMAN ({p.budgetBurnRatePct?.toFixed(0)}%)
                            </span>
                          ) : (
                            <span className="text-xs text-muted">-</span>
                          )}
                        </td>
                        <td className="col-num positive font-semibold">
                          {formatRupiah(p.totalInflow)}
                        </td>
                        <td className="col-num font-semibold" style={{ color: p.netBalance >= 0 ? "var(--color-success)" : "var(--color-warning)" }}>
                          {formatRupiah(p.netBalance)}
                        </td>
                        <td className="text-center">
                          {p.physicalProgressPct !== null ? (
                            <span className="status status-success font-bold" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                              {p.physicalProgressPct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                              Belum ada
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <Link
                            href={`/projects/${p.projectId}${isTest ? "?scope=TEST" : ""}`}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                          >
                            Detail 360° →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
    </PageMotion>
  );
}
