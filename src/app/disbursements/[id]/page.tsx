import Link from "next/link";
import { notFound } from "next/navigation";
import { getDisbursementDetail } from "../../actions/disbursement.actions";
import { formatRupiah, formatDate, txStatusLabel } from "@/lib/utils/format";
import VoidDisbursementButton from "./VoidDisbursementButton";

export default async function DisbursementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const disb = await getDisbursementDetail(id);

  if (!disb) return notFound();

  const txInfo = txStatusLabel(disb.status);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{disb.disbursementNumber}</h1>
          <div className="page-header-subtitle">
            Detail pencairan — {formatDate(disb.disbursementDate)}
          </div>
        </div>
        <div className="flex gap-2">
          {disb.status === "POSTED" && (
            <VoidDisbursementButton
              disbursementId={disb.id}
              disbursementNumber={disb.disbursementNumber}
            />
          )}
          <Link href="/disbursements" className="btn btn-secondary">
            ← Kembali
          </Link>
        </div>
      </div>

      <div className="page-body">
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Status</div>
            <span className={`status ${txInfo.className}`} style={{ fontSize: "0.82rem", padding: "4px 12px" }}>
              <span className="status-dot"></span>
              {txInfo.label}
            </span>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Pencairan</div>
            <div className="stat-value">
              {formatRupiah(Number(disb.totalRealizedAmount))}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Metode</div>
            <div className="font-semibold">{disb.paymentMethod}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Akun Pembayar</div>
            <div className="font-medium">{disb.cashAccount.accountName}</div>
            <div className="text-xs text-muted">{disb.cashAccount.accountCode}</div>
          </div>
        </div>

        {disb.notes && (
          <div className="alert alert-info mb-6">
            <strong>Catatan:</strong> {disb.notes}
          </div>
        )}

        {disb.status === "VOID" && disb.voidReason && (
          <div className="alert alert-error mb-6">
            <strong>Alasan Void:</strong> {disb.voidReason}
            {disb.voidedAt && (
              <span className="text-sm"> — {formatDate(disb.voidedAt, true)}</span>
            )}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2>Rincian Item</h2>
            <span className="text-sm text-secondary">{disb.items.length} item</span>
          </div>
          <div className="card-body-flush">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No Kas</th>
                  <th>Proyek</th>
                  <th>Uraian</th>
                  <th>PIC</th>
                  <th className="text-right">Nominal ACC</th>
                  <th className="text-right">Dicairkan</th>
                </tr>
              </thead>
              <tbody>
                {disb.items.map((item) => (
                  <tr key={item.id}>
                    <td className="col-mono">{item.accItem.noKas}</td>
                    <td className="text-sm font-medium">
                      {item.accItem.project.code}
                    </td>
                    <td className="truncate" style={{ maxWidth: 200 }}>
                      {item.accItem.description}
                    </td>
                    <td className="text-sm">{item.accItem.pic.name}</td>
                    <td className="col-num">
                      {formatRupiah(Number(item.accItem.approvedAmount))}
                    </td>
                    <td className="col-num font-semibold">
                      {formatRupiah(Number(item.realizedAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
