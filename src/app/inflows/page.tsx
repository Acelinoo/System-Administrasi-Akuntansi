import Link from "next/link";
import { getInflowList } from "../actions/inflow.actions";
import { getMasterCashAccounts } from "../actions/acc.actions";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import InflowFormDialog from "./InflowFormDialog";
import VoidInflowButton from "./VoidInflowButton";
import { DataScope } from "@prisma/client";

export default async function InflowListPage({
  searchParams,
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const params = await searchParams;
  const isTest = params?.scope === "TEST";
  const scope = isTest ? DataScope.TEST : DataScope.REAL;

  const [inflows, accounts, projects, realCount, testCount] = await Promise.all([
    getInflowList(scope),
    getMasterCashAccounts(),
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.fundInflow.count({ where: { dataScope: DataScope.REAL } }),
    prisma.fundInflow.count({ where: { dataScope: DataScope.TEST } }),
  ]);

  const postedInflows = inflows.filter((i) => i.status === "POSTED");
  const totalPosted = postedInflows.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalCash = postedInflows
    .filter((i) => i.destinationAccount.accountType === "CASH")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const totalBank = postedInflows
    .filter((i) => i.destinationAccount.accountType === "BANK")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1>Penerimaan Dana</h1>
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
              ? "Lingkungan Terisolasi — Menampilkan dropping dana hasil pengujian manual (dataScope: TEST)."
              : "Catat dropping dana atau penerimaan kas operasional dari atasan / manajemen"}
          </div>
        </div>
        <InflowFormDialog
          accounts={JSON.parse(JSON.stringify(accounts))}
          projects={JSON.parse(JSON.stringify(projects))}
          scope={isTest ? "TEST" : "REAL"}
        />
      </div>

      <div className="page-body">
        {/* Scope Switcher Tabs */}
        <div className="scope-tabs mb-6">
          <Link
            href="/inflows"
            className={`scope-tab ${!isTest ? "active" : ""}`}
            title="Lihat Penerimaan Dana Data Operasional Nyata (REAL)"
          >
            <span className="status-indicator-dot online" />
            <span>Data Operasional (REAL)</span>
            <span className="scope-tab-badge">{realCount}</span>
          </Link>
          <Link
            href="/inflows?scope=TEST"
            className={`scope-tab ${isTest ? "active test-active" : ""}`}
            title="Lihat Penerimaan Dana Pengujian UAT (TEST)"
          >
            <span className="status-indicator-dot test" />
            <span>Pengujian UAT (TEST)</span>
            <span className="scope-tab-badge">{testCount}</span>
          </Link>
        </div>

        {/* 4 SUMMARY CARDS (MONETIRA STYLE) */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Total Dana Masuk</div>
              <div className="stat-value positive">{formatRupiah(totalPosted)}</div>
            </div>
            <div className="stat-sub">Akumulasi seluruh dropping dana posted</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Kas Tunai (KAS)</div>
              <div className="stat-value">{formatRupiah(totalCash)}</div>
            </div>
            <div className="stat-sub">Dana masuk ke akun kas fisik</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Rekening Bank (BANK)</div>
              <div className="stat-value">{formatRupiah(totalBank)}</div>
            </div>
            <div className="stat-sub">Dana transfer rekening bank</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Jumlah Transaksi</div>
              <div className="stat-value">{inflows.length}</div>
            </div>
            <div className="stat-sub">{postedInflows.length} posted • {inflows.length - postedInflows.length} void/lainnya</div>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="card">
          <div className="card-header">
            <h2>Daftar Transaksi Penerimaan Dana</h2>
            <span className="text-xs text-muted font-medium">{inflows.length} transaksi</span>
          </div>
          <div className="card-body-flush">
            {inflows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <div className="empty-state-title">Belum ada penerimaan dana</div>
                <div className="empty-state-desc">
                  Gunakan tombol di atas untuk mencatatkan dropping dana baru.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. Inflow</th>
                      <th>Tanggal</th>
                      <th>Akun Tujuan</th>
                      <th>Proyek</th>
                      <th>Sumber Dana</th>
                      <th>Referensi</th>
                      <th className="text-right">Nominal Masuk</th>
                      <th>Status</th>
                      <th className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflows.map((inflow) => {
                      const txInfo = txStatusLabel(inflow.status);
                      return (
                        <tr key={inflow.id}>
                          <td className="col-mono font-semibold text-slate-900">{inflow.inflowNumber}</td>
                          <td className="text-sm text-muted">{formatDate(inflow.inflowDate)}</td>
                          <td>
                            <span className="font-semibold text-slate-900">
                              {inflow.destinationAccount.accountName}
                            </span>
                            <span className="text-xs text-muted ml-1.5">
                              ({inflow.destinationAccount.accountType})
                            </span>
                          </td>
                          <td>
                            {inflow.project ? (
                              <span
                                className="status status-neutral"
                                style={{ fontSize: "0.72rem", padding: "1px 6px" }}
                              >
                                {inflow.project.code}
                              </span>
                            ) : (
                              <span className="text-xs text-muted">Umum</span>
                            )}
                          </td>
                          <td className="text-sm text-slate-800">{inflow.sourceInfo}</td>
                          <td className="text-sm text-muted">
                            {inflow.referenceNo || "-"}
                          </td>
                          <td className="col-num font-semibold text-slate-900" style={{ fontSize: "0.9rem" }}>
                            {formatRupiah(Number(inflow.amount))}
                          </td>
                          <td>
                            <span className={`status ${txInfo.className}`}>
                              <span className="status-dot" />
                              {txInfo.label}
                            </span>
                          </td>
                          <td className="text-center">
                            {inflow.status === "POSTED" ? (
                              <VoidInflowButton
                                inflowId={inflow.id}
                                inflowNumber={inflow.inflowNumber}
                              />
                            ) : (
                              <span className="text-xs text-muted">-</span>
                            )}
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
