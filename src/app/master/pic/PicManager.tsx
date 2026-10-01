"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPicAction, togglePicStatusAction } from "../../actions/master.actions";

interface PicItem {
  id: string;
  name: string;
  roleTitle: string | null;
  phone: string | null;
  isActive: boolean;
  _count: { accExpenseItems: number };
}

export default function PicManager({ pics }: { pics: PicItem[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleStatus = async (id: string, current: boolean) => {
    if (!confirm(`Ubah status PIC menjadi ${current ? "NON-AKTIF" : "AKTIF"}?`)) return;
    await togglePicStatusAction(id, current);
    router.refresh();
  };

  const handleAddPic = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createPicAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowModal(false);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Daftar PIC Lapangan</h2>
          <div className="text-xs text-muted">
            Person in Charge yang bertanggung jawab atas penggunaan dan realisasi uang di lapangan
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setShowModal(true);
            setError(null);
          }}
        >
          ➕ Tambah PIC Baru
        </button>
      </div>

      <div className="card">
        <div className="card-body-flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama PIC</th>
                <th>Jabatan / Peran</th>
                <th>No Telepon</th>
                <th className="text-center">Total Transaksi ACC</th>
                <th className="text-center">Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pics.map((pic) => (
                <tr key={pic.id}>
                  <td className="font-semibold">{pic.name}</td>
                  <td className="text-sm">{pic.roleTitle || "-"}</td>
                  <td className="text-sm text-mono">{pic.phone || "-"}</td>
                  <td className="text-center text-sm font-medium">
                    {pic._count.accExpenseItems} transaksi
                  </td>
                  <td className="text-center">
                    <span
                      className={`status ${pic.isActive ? "status-success" : "status-neutral"}`}
                    >
                      <span className="status-dot"></span>
                      {pic.isActive ? "Aktif" : "Non-Aktif"}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      onClick={() => handleToggleStatus(pic.id, pic.isActive)}
                    >
                      {pic.isActive ? "Non-aktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add PIC */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Tambah PIC Baru</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddPic}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                <div className="form-group mb-3">
                  <label className="form-label required">Nama PIC</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Contoh: PA HERI, PA DEDI"
                    className="form-control"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label">Jabatan / Peran</label>
                  <input
                    type="text"
                    name="roleTitle"
                    placeholder="Contoh: Mandor Proyek / Logistik"
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nomor WhatsApp / HP</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="Contoh: 08123456789"
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan PIC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
