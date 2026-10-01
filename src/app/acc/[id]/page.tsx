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
          <div className="flex items-center gap-3">
            <h1>{item.noKas}</h1>
            <span className={`status ${statusInfo.className}`}>
              <span className="status-dot" />
              {statusInfo.label}
            </span>
            <span className="text-xs text-muted">
              • {formatDate(item.batch.accDate)}
            </span>
          </div>
          <div className="page-header-subtitle">
            <span className="font-semibold text-slate-800">{item.project.code}</span> — {item.description}
          </div>
        </div>
        <Link href="/acc" className="btn btn-secondary">
          ← Kembali ke Data ACC
        </Link>
      </div>

      <div className="page-body">
        {/* 1. PROMINENT FINANCIAL SUMMARY (MONETIRA 4-CARD HERO) */}
        <div className="stat-grid mb-6">
          <div className="stat-card" style={{ borderColor: "var(--blue-200)", background: "#ffffff" }}>
            <div>
              <div className="stat-label" style={{ color: "var(--blue-600)" }}>Nominal ACC (Dasar Administrasi)</div>
              <div className="stat-value primary">{formatRupiah(Number(item.approvedAmount))}</div>
            </div>
            <div className="stat-sub font-medium" style={{ color: "var(--blue-600)" }}>
              ✓ Nilai sah yang disetujui atasan
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Nominal Pengajuan Awal (Ref)</div>
              <div className="stat-value text-muted" style={{ fontSize: "1.35rem" }}>
                {item.requestedAmount ? formatRupiah(Number(item.requestedAmount)) : "-"}
              </div>
            </div>
            <div className="stat-sub">Referensi pengajuan di luar sistem</div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Realisasi Pencairan</div>
              <div className={`stat-value ${totalRealized > 0 ? "positive" : ""}`}>
                {formatRupiah(totalRealized)}
              </div>
            </div>
            <div className="stat-sub">
              {Number(item.approvedAmount) > 0
                ? `${((totalRealized / Number(item.approvedAmount)) * 100).toFixed(1)}% telah dicairkan`
                : "Rp0"}
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Sisa Outstanding</div>
              <div className={`stat-value ${outstanding > 0 ? "warning" : "positive"}`}>
                {formatRupiah(outstanding)}
              </div>
            </div>
            <div className="stat-sub">Kewajiban pencairan tersisa</div>
          </div>
        </div>

        {/* 2. DETAIL CARDS (2-COLUMN GRID) */}
        <div className="grid-2 mb-6">
          {/* Card 1: Info Data ACC */}
          <div className="card">
            <div className="card-header">
              <h2>Informasi Data ACC</h2>
            </div>
            <div className="card-body">
              <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0", width: "40%" }}>No Kas</td>
                    <td className="font-semibold text-mono text-slate-900">{item.noKas}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Jenis Kas</td>
                    <td className="font-medium text-slate-800">{item.cashType === "KU" ? "KU — Kas Umum (Operasional)" : "KT — Kas Terikat (Proyek)"}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Kode Batch</td>
                    <td className="text-mono text-slate-700">{item.batch.batchCode}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Tanggal ACC</td>
                    <td className="text-slate-800">{formatDate(item.batch.accDate)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Atasan Peng-ACC</td>
                    <td className="font-semibold text-slate-900">{item.batch.approvedByName}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Status Administrasi</td>
                    <td>
                      <span className={`status ${statusInfo.className}`}>
                        <span className="status-dot" />
                        {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Klasifikasi Proyek & Beban */}
          <div className="card">
            <div className="card-header">
              <h2>Klasifikasi Proyek & Beban</h2>
            </div>
            <div className="card-body">
              <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0", width: "40%" }}>Proyek</td>
                    <td>
                      <span className="font-semibold text-slate-900">{item.project.code}</span>
                      <span className="text-muted"> — {item.project.name}</span>
                      {item.project.confirmationStatus === "REQUIRES_BUSINESS_CONFIRMATION" && (
                        <div className="mt-1">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold inline-block"
                            style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                          >
                            REQUIRES BUSINESS CONFIRMATION
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                  {item.subUnit && (
                    <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <td className="text-secondary" style={{ padding: "8px 0" }}>Sub Unit</td>
                      <td className="text-slate-800">{item.subUnit.code} — {item.subUnit.name}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Kategori Biaya</td>
                    <td className="font-medium text-slate-800">{item.category.name}</td>
                  </tr>
                  {item.subCategory && (
                    <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <td className="text-secondary" style={{ padding: "8px 0" }}>Sub Kategori</td>
                      <td className="text-slate-800">{item.subCategory.name}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>PIC Lapangan</td>
                    <td>
                      {item.assignmentStatus === "UNASSIGNED_MANDOR" ? (
                        <div>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold inline-block"
                            style={{ background: "#ffedd5", color: "#c2410c", border: "1px solid #fed7aa" }}
                          >
                            UNASSIGNED MANDOR
                          </span>
                          <span className="text-xs text-muted ml-1.5">(Belum ditentukan)</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-900">{item.pic.name}</span>
                      )}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Submitter Administratif</td>
                    <td>
                      <span className="font-medium text-slate-800">{item.batch.administrativeSubmitter || "NISA"}</span>
                      <span className="text-xs text-muted ml-1.5">(Staff penginput)</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-secondary" style={{ padding: "8px 0" }}>Uraian Kebutuhan</td>
                    <td className="text-slate-900 font-medium">{item.description}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. RIWAYAT PENCAIRAN / REALISASI */}
        <div className="card">
          <div className="card-header">
            <h2>Riwayat Pencairan / Realisasi</h2>
            <span className="text-xs text-muted font-medium">
              {item.disbursementItems.length} transaksi voucher
            </span>
          </div>
          <div className="card-body-flush">
            {item.disbursementItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <div className="empty-state-title">Belum ada realisasi pencairan</div>
                <div className="empty-state-desc">
                  Item ini belum memiliki catatan pencairan dana.
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
                    <th className="text-right">Nominal Realisasi</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {item.disbursementItems.map((di) => {
                    const txInfo = txStatusLabel(di.disbursement.status);
                    return (
                      <tr key={di.id}>
                        <td className="col-mono font-semibold">
                          <Link href={`/disbursements/${di.disbursementId}`} className="text-primary hover:underline">
                            {di.disbursement.disbursementNumber}
                          </Link>
                        </td>
                        <td className="text-sm text-muted">
                          {formatDate(di.disbursement.disbursementDate)}
                        </td>
                        <td className="text-sm">
                          {di.disbursement.paymentMethod}
                        </td>
                        <td className="text-sm font-medium">
                          {di.disbursement.cashAccount.accountName}
                        </td>
                        <td className="col-num font-semibold text-slate-900">
                          {formatRupiah(Number(di.realizedAmount))}
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}
