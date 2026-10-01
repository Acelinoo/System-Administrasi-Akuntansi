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

  const totalPosted = inflows
    .filter((i) => i.status === "POSTED")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Penerimaan Dana</h1>
          <div className="page-header-subtitle">
            {inflows.length} transaksi — Total posted: {formatRupiah(totalPosted)}
          </div>
        </div>
        <InflowFormDialog accounts={JSON.parse(JSON.stringify(accounts))} />
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-body-flush">
            {inflows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <div className="empty-state-title">Belum ada penerimaan dana</div>
                <div className="empty-state-desc">
                  Catat dropping dana atau penerimaan lain dari atasan/manajemen.
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
                      <th className="text-right">Nominal</th>
                      <th>Status</th>
                      <th className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflows.map((inflow) => {
                      const txInfo = txStatusLabel(inflow.status);
                      return (
                        <tr key={inflow.id}>
                          <td className="col-mono">{inflow.inflowNumber}</td>
                          <td className="text-sm">{formatDate(inflow.inflowDate)}</td>
                          <td>
                            <span className="font-medium">
                              {inflow.destinationAccount.accountName}
                            </span>
                            <br />
                            <span className="text-xs text-muted">
                              {inflow.destinationAccount.accountType}
                            </span>
                          </td>
                          <td>{inflow.sourceInfo}</td>
                          <td className="text-sm text-muted">
                            {inflow.referenceNo || "-"}
                          </td>
                          <td className="col-num font-semibold">
                            {formatRupiah(Number(inflow.amount))}
                          </td>
                          <td>
                            <span className={`status ${txInfo.className}`}>
                              <span className="status-dot"></span>
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
