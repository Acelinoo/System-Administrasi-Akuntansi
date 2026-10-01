"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  createSubCategoryAction,
  toggleCategoryStatusAction,
} from "../../actions/master.actions";

interface CategoryItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  subCategories: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }[];
  _count: { accExpenseItems: number };
}

export default function CategoriesManager({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleStatus = async (id: string, current: boolean) => {
    if (!confirm(`Ubah status kategori menjadi ${current ? "NON-AKTIF" : "AKTIF"}?`)) return;
    await toggleCategoryStatusAction(id, current);
    router.refresh();
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createCategoryAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowCategoryModal(false);
      router.refresh();
    }
  };

  const handleAddSubCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createSubCategoryAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowSubCategoryModal(false);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Daftar Kategori Biaya</h2>
          <div className="text-xs text-muted">
            Klasifikasi pengeluaran ACC dan pemetaan ke pos akuntansi
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (categories.length === 0) return;
              setSelectedCatId(categories[0].id);
              setShowSubCategoryModal(true);
              setError(null);
            }}
          >
            ➕ Tambah Sub-Kategori
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowCategoryModal(true);
              setError(null);
            }}
          >
            ➕ Tambah Kategori Baru
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body-flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Kategori</th>
                <th>Sub-Kategori Terdaftar</th>
                <th className="text-center">Total Transaksi</th>
                <th className="text-center">Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="col-mono font-semibold">{cat.code}</td>
                  <td className="font-medium">{cat.name}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {cat.subCategories.length === 0 ? (
                        <span className="text-xs text-muted">-</span>
                      ) : (
                        cat.subCategories.map((sub) => (
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
                    {cat._count.accExpenseItems} ACC
                  </td>
                  <td className="text-center">
                    <span
                      className={`status ${cat.isActive ? "status-success" : "status-neutral"}`}
                    >
                      <span className="status-dot"></span>
                      {cat.isActive ? "Aktif" : "Non-Aktif"}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      onClick={() => handleToggleStatus(cat.id, cat.isActive)}
                    >
                      {cat.isActive ? "Non-aktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Category */}
      {showCategoryModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Tambah Kategori Baru</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCategoryModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCategory}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                <div className="form-group mb-3">
                  <label className="form-label required">Kode Kategori</label>
                  <input
                    type="text"
                    name="code"
                    required
                    placeholder="Contoh: UPAH, MATERIAL, ALAT"
                    className="form-control"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Nama Kategori</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Contoh: Biaya Upah Tukang"
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Sub-Category */}
      {showSubCategoryModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Tambah Sub-Kategori</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSubCategoryModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSubCategory}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                <div className="form-group mb-3">
                  <label className="form-label required">Pilih Kategori Induk</label>
                  <select
                    name="categoryId"
                    className="form-control"
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group mb-3">
                  <label className="form-label required">Kode Sub-Kategori</label>
                  <input
                    type="text"
                    name="code"
                    required
                    placeholder="Contoh: BESI, SEMEN, PASIR"
                    className="form-control"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Nama Sub-Kategori</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Contoh: Pembelian Besi Beton"
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSubCategoryModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Sub-Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
