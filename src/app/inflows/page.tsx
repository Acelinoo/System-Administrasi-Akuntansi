import { getInflowList } from "../actions/inflow.actions";
import { getMasterCashAccounts } from "../actions/acc.actions";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import InflowFormDialog from "./InflowFormDialog";
import VoidInflowButton from "./VoidInflowButton";

export default async function InflowListPage() {
  const [inflows, accounts] = await Promise.all([
    getInflowList(),
    getMasterCashAccounts(),
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
          <h1>Penerimaan Dana</h1>
          <div className="page-header-subtitle">
            Catat dropping dana atau penerimaan kas operasional dari atasan / manajemen
          </div>
        </div>
        <InflowFormDialog accounts={JSON.parse(JSON.stringify(accounts))} />
      </div>

      <div className="page-body">
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
