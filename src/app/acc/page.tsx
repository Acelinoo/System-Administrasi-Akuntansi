import Link from "next/link";
import { getAccItemList, getMasterProjects } from "../actions/acc.actions";
import { formatRupiah, formatDate, accStatusLabel } from "@/lib/utils/format";
import { AccStatus } from "@prisma/client";
import AccFilters from "./AccFilters";

export default async function AccListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; projectId?: string; search?: string }>;
}) {
  const params = await searchParams;
  const filters = {
    status: params.status as AccStatus | undefined,
    projectId: params.projectId || undefined,
    search: params.search || undefined,
  };

  const [items, projects] = await Promise.all([
    getAccItemList(filters),
    getMasterProjects(),
  ]);

  // Calculate totals
  const totalApproved = items.reduce(
    (sum, item) => sum + Number(item.approvedAmount),
    0
  );
  const totalRealized = items.reduce(
    (sum, item) =>
      sum +
      item.disbursementItems.reduce(
        (s, d) => s + Number(d.realizedAmount),
        0
      ),
    0
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Daftar Pengajuan ACC</h1>
          <div className="page-header-subtitle">
            {items.length} item — Total ACC: {formatRupiah(totalApproved)} | Realisasi:{" "}
            {formatRupiah(totalRealized)}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Link href="/acc/import" className="btn btn-secondary">
            📥 Impor Excel
          </Link>
          <Link href="/acc/new" className="btn btn-primary">
            + Input ACC Baru
          </Link>
        </div>
      </div>

      <AccFilters projects={projects} currentFilters={params} />

      <div className="card" style={{ margin: "0 var(--space-8)", marginBottom: "var(--space-6)" }}>
        <div className="card-body-flush">
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Belum ada data pengajuan</div>
              <div className="empty-state-desc">
                Mulai dengan memasukkan data ACC yang sudah disetujui atasan.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No Kas</th>
                    <th>Tanggal ACC</th>
                    <th>Proyek</th>
                    <th>Kategori</th>
                    <th>Uraian</th>
                    <th>PIC</th>
                    <th className="text-right">Nominal ACC</th>
                    <th className="text-right">Realisasi</th>
                    <th>Status</th>
                    <th className="col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const realized = item.disbursementItems.reduce(
                      (s, d) => s + Number(d.realizedAmount),
                      0
                    );
                    const statusInfo = accStatusLabel(item.status);

                    return (
                      <tr key={item.id}>
                        <td className="col-mono">{item.noKas}</td>
                        <td className="text-sm">
                          {formatDate(item.batch.accDate)}
                        </td>
                        <td>
                          <span className="font-medium">
                            {item.project.code}
                          </span>
                          {item.subUnit && (
                            <span className="text-muted text-xs">
                              {" "}
                              / {item.subUnit.code}
                            </span>
                          )}
                        </td>
                        <td className="text-sm">
                          {item.category.name}
                          {item.subCategory && (
                            <span className="text-muted text-xs">
                              {" "}
                              — {item.subCategory.name}
                            </span>
                          )}
                        </td>
                        <td
                          className="truncate"
                          style={{ maxWidth: 200 }}
                          title={item.description}
                        >
                          {item.description}
                        </td>
                        <td>
                          {item.assignmentStatus === "UNASSIGNED_MANDOR" ? (
                            <div>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-bold inline-block"
                                style={{ background: "#ffedd5", color: "#c2410c", border: "1px solid #fed7aa" }}
                                title="PIC Lapangan belum ditentukan berdasarkan evidence sumber"
                              >
                                UNASSIGNED MANDOR
                              </span>
                              <div className="text-[11px] text-muted mt-0.5">
                                PIC Lapangan: <em>Belum Ditentukan</em>
                              </div>
                              {item.batch.administrativeSubmitter && (
                                <div className="text-[10px] text-secondary">
                                  Submitter: {item.batch.administrativeSubmitter}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-sm">{item.pic.name}</div>
                              {item.batch.administrativeSubmitter && (
                                <div className="text-[10px] text-muted">
                                  Sub: {item.batch.administrativeSubmitter}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="col-num">
                          {formatRupiah(Number(item.approvedAmount))}
                        </td>
                        <td className="col-num">
                          {realized > 0 ? formatRupiah(realized) : "-"}
                        </td>
                        <td>
                          <span className={`status ${statusInfo.className}`}>
                            <span className="status-dot"></span>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="col-actions">
                          <Link
                            href={`/acc/${item.id}`}
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
    </>
  );
}
