"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProjectAction,
  updateProjectAction,
  createSubUnitAction,
  toggleProjectStatusAction,
} from "../../actions/master.actions";
import { formatRupiah, formatDate } from "@/lib/utils/format";

interface ProjectItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clientName?: string | null;
  contractValue?: any;
  targetStartDate?: any;
  targetEndDate?: any;
  isActive: boolean;
  confirmationStatus?: string;
  possibleParentCode?: string | null;
  subUnits: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }[];
  _count: { accExpenseItems: number; fundInflows?: number };
}

export default function ProjectsManager({ projects }: { projects: ProjectItem[] }) {
  const router = useRouter();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [showSubUnitModal, setShowSubUnitModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleStatus = async (id: string, current: boolean) => {
    if (!confirm(`Ubah status proyek menjadi ${current ? "NON-AKTIF" : "AKTIF"}?`)) return;
    await toggleProjectStatusAction(id, current);
    router.refresh();
  };

  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createProjectAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowProjectModal(false);
      router.refresh();
    }
  };

  const handleOpenEdit = (proj: ProjectItem) => {
    setEditingProject(proj);
    setError(null);
    setShowEditModal(true);
  };

  const handleEditProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await updateProjectAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowEditModal(false);
      setEditingProject(null);
      router.refresh();
    }
  };

  const handleAddSubUnit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createSubUnitAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowSubUnitModal(false);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Daftar Proyek & Sub-Unit</h2>
          <div className="text-xs text-muted">
            Struktur proyek hierarkis, informasi kontrak, dan alokasi operasional
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (projects.length === 0) return;
              setSelectedProjectId(projects[0].id);
              setShowSubUnitModal(true);
              setError(null);
            }}
          >
            ➕ Tambah Sub-Unit
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowProjectModal(true);
              setError(null);
            }}
          >
            ➕ Tambah Proyek Baru
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Proyek & Klien</th>
                <th>Nilai Kontrak & Target</th>
                <th>Sub-Unit Terdaftar</th>
                <th className="text-center">Total Transaksi</th>
                <th className="text-center">Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((proj) => (
                <tr key={proj.id}>
                  <td className="col-mono font-semibold">{proj.code}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{proj.name}</span>
                      {proj.confirmationStatus === "REQUIRES_BUSINESS_CONFIRMATION" && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: "#ffedd5", color: "#c2410c" }}
                        >
                          KANDIDAT — KONFIRMASI BISNIS
                        </span>
                      )}
                    </div>
                    {proj.clientName && (
                      <div className="text-xs text-slate-700 font-medium mt-0.5 flex items-center gap-1">
                        <span className="text-muted">Klien:</span> {proj.clientName}
                      </div>
                    )}
                    {proj.possibleParentCode && (
                      <div className="text-[11px] text-warning font-medium mt-0.5">
                        Induk potensial: {proj.possibleParentCode} (Perlu verifikasi)
                      </div>
                    )}
                    {proj.description && (
                      <div className="text-xs text-muted truncate" style={{ maxWidth: 260 }}>
                        {proj.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="text-sm font-semibold text-slate-900">
                      {proj.contractValue ? formatRupiah(Number(proj.contractValue)) : <span className="text-muted font-normal text-xs">-</span>}
                    </div>
                    {(proj.targetStartDate || proj.targetEndDate) && (
                      <div className="text-xs text-muted mt-0.5">
                        {proj.targetStartDate ? formatDate(proj.targetStartDate) : "TBA"} s/d {proj.targetEndDate ? formatDate(proj.targetEndDate) : "TBA"}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {proj.subUnits.length === 0 ? (
                        <span className="text-xs text-muted">-</span>
                      ) : (
                        proj.subUnits.map((sub) => (
                          <span
                            key={sub.id}
                            className="status status-neutral"
                            style={{ fontSize: "0.72rem", padding: "1px 6px" }}
                          >
                            {sub.code} ({sub.name})
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="text-center text-sm font-medium">
                    <div>{proj._count.accExpenseItems} ACC</div>
                    {typeof proj._count.fundInflows === "number" && proj._count.fundInflows > 0 && (
                      <div className="text-xs text-emerald-600 font-medium">
                        {proj._count.fundInflows} Inflow
                      </div>
                    )}
                  </td>
                  <td className="text-center">
                    <span
                      className={`status ${proj.isActive ? "status-success" : "status-neutral"}`}
                    >
                      <span className="status-dot"></span>
                      {proj.isActive ? "Aktif" : "Non-Aktif"}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                        onClick={() => handleOpenEdit(proj)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                        onClick={() => handleToggleStatus(proj.id, proj.isActive)}
                      >
                        {proj.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Project */}
      {showProjectModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Tambah Proyek Baru</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowProjectModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddProject}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="form-group">
                    <label className="form-label required">Kode Proyek</label>
                    <input
                      type="text"
                      name="code"
                      required
                      placeholder="Contoh: ALCENT"
                      className="form-control"
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Nama Proyek</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Contoh: Al-Azhar Centralized"
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Owner / Klien</label>
                    <input
                      type="text"
                      name="clientName"
                      placeholder="Contoh: Yayasan Al-Azhar"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nilai Kontrak (Rp)</label>
                    <input
                      type="number"
                      name="contractValue"
                      placeholder="0"
                      min="0"
                      step="1"
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Target Mulai</label>
                    <input
                      type="date"
                      name="targetStartDate"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Selesai</label>
                    <input
                      type="date"
                      name="targetEndDate"
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Deskripsi / Keterangan</label>
                  <textarea
                    name="description"
                    rows={2}
                    className="form-control"
                    placeholder="Keterangan opsional..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProjectModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Proyek"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Project */}
      {showEditModal && editingProject && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Edit Proyek: {editingProject.code}</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProject(null);
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditProject}>
              <input type="hidden" name="id" value={editingProject.id} />
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                
                <div className="form-group mb-3">
                  <label className="form-label required">Nama Proyek</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingProject.name}
                    className="form-control"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Owner / Klien</label>
                    <input
                      type="text"
                      name="clientName"
                      defaultValue={editingProject.clientName || ""}
                      placeholder="Nama klien..."
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nilai Kontrak (Rp)</label>
                    <input
                      type="number"
                      name="contractValue"
                      defaultValue={editingProject.contractValue ? Number(editingProject.contractValue) : ""}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Target Mulai</label>
                    <input
                      type="date"
                      name="targetStartDate"
                      defaultValue={
                        editingProject.targetStartDate
                          ? new Date(editingProject.targetStartDate).toISOString().slice(0, 10)
                          : ""
                      }
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Selesai</label>
                    <input
                      type="date"
                      name="targetEndDate"
                      defaultValue={
                        editingProject.targetEndDate
                          ? new Date(editingProject.targetEndDate).toISOString().slice(0, 10)
                          : ""
                      }
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Deskripsi / Keterangan</label>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={editingProject.description || ""}
                    className="form-control"
                    placeholder="Keterangan opsional..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProject(null);
                  }}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Sub-Unit */}
      {showSubUnitModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Tambah Sub-Unit Proyek</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSubUnitModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSubUnit}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                <div className="form-group mb-3">
                  <label className="form-label required">Pilih Proyek Induk</label>
                  <select
                    name="projectId"
                    className="form-control"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label required">Kode Sub-Unit</label>
                  <input
                    type="text"
                    name="code"
                    required
                    placeholder="Contoh: SMP, SMA, SIPIL"
                    className="form-control"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Nama Sub-Unit</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Contoh: Gedung SMP"
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSubUnitModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Sub-Unit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
