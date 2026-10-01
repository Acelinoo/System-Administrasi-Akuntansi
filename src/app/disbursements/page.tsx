import Link from "next/link";
import { getDisbursementList } from "../actions/disbursement.actions";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";

export default async function DisbursementListPage() {
  const disbursements = await getDisbursementList();

  const totalPosted = disbursements
    .filter((d) => d.status === "POSTED")
    .reduce((sum, d) => sum + Number(d.totalRealizedAmount), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Pencairan / Realisasi</h1>
          <div className="page-header-subtitle">
            {disbursements.length} transaksi — Total posted: {formatRupiah(totalPosted)}
          </div>
        </div>
        <Link href="/disbursements/new" className="btn btn-primary">
          + Pencairan Baru
        </Link>
      </div>

      <div className="page-body">
        {/* HOLDING STATE NOTICE */}
        <div className="card mb-6" style={{ background: "#fffbeb", border: "1px solid #fef3c7" }}>
          <div className="card-body">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs px-2 py-0.5 rounded font-bold"
                style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
              >
                HOLDING STATE
              </span>
              <span className="font-semibold text-xs" style={{ color: "#92400e" }}>
                4 Catatan Realisasi Sumber Excel (Rp34.299.517) Tertahan di PENDING_CONFIRMATION
              </span>
            </div>
            <div className="text-xs text-secondary">
              Transaksi realisasi sumber Excel belum diposting ke voucher pencairan karena menunggu konfirmasi resmi mengenai akun kas/bank pembayar dan tanggal efektif pembukuan.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body-flush">
            {disbursements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <div className="empty-state-title">Belum ada pencairan</div>
                <div className="empty-state-desc">
                  Setelah ada pengajuan ACC yang di-approve, Anda dapat mencatatkan pencairan/realisasinya.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. Pencairan</th>
                      <th>Tanggal</th>
                      <th>Metode</th>
                      <th>Akun Pembayar</th>
                      <th className="text-right">Item</th>
                      <th className="text-right">Total</th>
                      <th>Status</th>
                      <th className="col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {disbursements.map((d) => {
                      const txInfo = txStatusLabel(d.status);
                      return (
                        <tr key={d.id}>
                          <td className="col-mono">{d.disbursementNumber}</td>
                          <td className="text-sm">{formatDate(d.disbursementDate)}</td>
                          <td className="text-sm">{d.paymentMethod}</td>
                          <td>
                            <span className="font-medium">
                              {d.cashAccount.accountName}
                            </span>
                          </td>
                          <td className="text-right text-sm">
                            {d._count.items}
                          </td>
                          <td className="col-num font-semibold">
                            {formatRupiah(Number(d.totalRealizedAmount))}
                          </td>
                          <td>
                            <span className={`status ${txInfo.className}`}>
                              <span className="status-dot"></span>
                              {txInfo.label}
                            </span>
                          </td>
                          <td className="col-actions">
                            <Link
                              href={`/disbursements/${d.id}`}
                              className="btn btn-ghost btn-sm"
                            >
                              Detail →
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
    </>
  );
}
