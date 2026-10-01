import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccItemDetail } from "../../actions/acc.actions";
import { formatRupiah, formatDate, accStatusLabel, txStatusLabel } from "@/lib/utils/format";

export default async function AccDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getAccItemDetail(id);

  if (!item) return notFound();

  const statusInfo = accStatusLabel(item.status);
  const totalRealized = item.disbursementItems.reduce(
    (sum, di) => sum + Number(di.realizedAmount),
    0
  );
  const outstanding = Math.max(0, Number(item.approvedAmount) - totalRealized);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{item.noKas}</h1>
          <div className="page-header-subtitle">{item.description}</div>
        </div>
        <Link href="/acc" className="btn btn-secondary">
          ← Kembali
        </Link>
      </div>

      <div className="page-body">
        {/* Status + Financials */}
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Status</div>
            <span className={`status ${statusInfo.className}`} style={{ fontSize: "0.82rem", padding: "4px 12px" }}>
              <span className="status-dot"></span>
              {statusInfo.label}
            </span>
          </div>
          <div className="stat-card">
            <div className="stat-label">Nominal ACC</div>
            <div className="stat-value">{formatRupiah(Number(item.approvedAmount))}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Realisasi</div>
            <div className="stat-value positive">{formatRupiah(totalRealized)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sisa Outstanding</div>
            <div className={`stat-value ${outstanding > 0 ? "warning" : ""}`}>
              {formatRupiah(outstanding)}
            </div>
          </div>
        </div>

        {/* Detail Info */}
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-header">
              <h2>Informasi Data ACC</h2>
            </div>
            <div className="card-body">
              <table style={{ width: "100%", fontSize: "0.85rem" }}>
                <tbody>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0", width: "40%" }}>No Kas</td>
                    <td className="font-medium text-mono">{item.noKas}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Jenis Kas</td>
                    <td>{item.cashType === "KU" ? "Kas Umum (KU)" : "Kas Terikat (KT)"}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Batch</td>
                    <td className="text-mono">{item.batch.batchCode}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Tanggal ACC</td>
                    <td>{formatDate(item.batch.accDate)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Atasan Peng-ACC</td>
                    <td>{item.batch.approvedByName}</td>
                  </tr>
                  {item.requestedAmount && (
                    <tr>
                      <td className="text-secondary" style={{ padding: "6px 0" }}>Nominal Pengajuan Awal (Ref)</td>
                      <td className="text-muted">{formatRupiah(Number(item.requestedAmount))}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Nominal ACC (Dasar Administrasi)</td>
                    <td className="font-semibold text-primary">{formatRupiah(Number(item.approvedAmount))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Klasifikasi</h2>
            </div>
            <div className="card-body">
              <table style={{ width: "100%", fontSize: "0.85rem" }}>
                <tbody>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0", width: "40%" }}>Proyek</td>
                    <td>
                      <span className="font-medium">{item.project.code}</span>
                      <span className="text-muted"> — {item.project.name}</span>
                      {item.project.confirmationStatus === "REQUIRES_BUSINESS_CONFIRMATION" && (
                        <div className="mt-1">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold inline-block"
                            style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                          >
                            REQUIRES BUSINESS CONFIRMATION
                          </span>
                          {item.project.possibleParentCode && (
                            <span className="text-[11px] text-muted ml-1.5">
                              (Kandidat Subproyek: {item.project.possibleParentCode})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {item.subUnit && (
                    <tr>
                      <td className="text-secondary" style={{ padding: "6px 0" }}>Sub Unit</td>
                      <td>
                        {item.subUnit.code} — {item.subUnit.name}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Kategori</td>
                    <td>{item.category.name}</td>
                  </tr>
                  {item.subCategory && (
                    <tr>
                      <td className="text-secondary" style={{ padding: "6px 0" }}>Sub Kategori</td>
                      <td>{item.subCategory.name}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>PIC Lapangan</td>
                    <td>
                      {item.assignmentStatus === "UNASSIGNED_MANDOR" ? (
                        <div>
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold inline-block"
                            style={{ background: "#ffedd5", color: "#c2410c", border: "1px solid #fed7aa" }}
                          >
                            UNASSIGNED MANDOR
                          </span>
                          <div className="text-xs text-muted mt-1">
                            PIC Lapangan belum ditentukan berdasarkan evidence sumber Excel.
                          </div>
                        </div>
                      ) : (
                        <span className="font-medium">{item.pic.name}</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Submitter Administratif</td>
                    <td>
                      <span className="font-medium">{item.batch.administrativeSubmitter || "NISA"}</span>
                      <span className="text-xs text-muted ml-2">(Staff penginput administrasi)</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "6px 0" }}>Uraian</td>
                    <td>{item.description}</td>
                  </tr>
                  {item.notes && (
                    <tr>
                      <td className="text-secondary" style={{ padding: "6px 0" }}>Catatan</td>
                      <td className="text-muted">{item.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Realization History */}
        <div className="card">
          <div className="card-header">
            <h2>Riwayat Pencairan / Realisasi</h2>
            <span className="text-sm text-secondary">
              {item.disbursementItems.length} transaksi
            </span>
          </div>
          <div className="card-body-flush">
            {item.disbursementItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <div className="empty-state-title">Belum ada pencairan</div>
                <div className="empty-state-desc">
                  Item ini belum memiliki realisasi pencairan.
                </div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No. Pencairan</th>
                    <th>Tanggal</th>
                    <th>Metode</th>
                    <th>Akun Pembayar</th>
                    <th className="text-right">Nominal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {item.disbursementItems.map((di) => {
                    const txInfo = txStatusLabel(di.disbursement.status);
                    return (
                      <tr key={di.id}>
                        <td className="col-mono">
                          {di.disbursement.disbursementNumber}
                        </td>
                        <td className="text-sm">
                          {formatDate(di.disbursement.disbursementDate)}
                        </td>
                        <td className="text-sm">
                          {di.disbursement.paymentMethod}
                        </td>
                        <td className="text-sm">
                          {di.disbursement.cashAccount.accountName}
                        </td>
                        <td className="col-num font-semibold">
                          {formatRupiah(Number(di.realizedAmount))}
                        </td>
                        <td>
                          <span className={`status ${txInfo.className}`}>
                            <span className="status-dot"></span>
                            {txInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
