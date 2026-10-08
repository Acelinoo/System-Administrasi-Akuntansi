"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createVendorAction,
  updateVendorAction,
  toggleVendorStatusAction,
} from "../../actions/master.actions";
import { formatDate } from "@/lib/utils/format";

export interface VendorItem {
  id: string;
  code: string | null;
  name: string;
  type: "SUPPLIER" | "SUBCONTRACTOR" | "SERVICE";
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const vendorTypeConfig: Record<
  VendorItem["type"],
  { label: string; bg: string; color: string; border: string }
> = {
  SUPPLIER: {
    label: "Supplier Material",
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
  },
  SUBCONTRACTOR: {
    label: "Subkontraktor",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
  },
  SERVICE: {
    label: "Vendor Jasa",
    bg: "#faf5ff",
    color: "#7e22ce",
    border: "#e9d5ff",
  },
};

export default function VendorsManager({ vendors }: { vendors: VendorItem[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch =
        !searchTerm.trim() ||
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.code && v.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.phone && v.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.address && v.address.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = selectedType === "ALL" || v.type === selectedType;
      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "ACTIVE" && v.isActive) ||
        (selectedStatus === "INACTIVE" && !v.isActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [vendors, searchTerm, selectedType, selectedStatus]);

  const stats = useMemo(() => {
    return {
      total: vendors.length,
      suppliers: vendors.filter((v) => v.type === "SUPPLIER").length,
      subcontractors: vendors.filter((v) => v.type === "SUBCONTRACTOR").length,
      services: vendors.filter((v) => v.type === "SERVICE").length,
    };
  }, [vendors]);

  const handleToggleStatus = async (id: string, current: boolean) => {
    if (!confirm(`Ubah status vendor menjadi ${current ? "NON-AKTIF" : "AKTIF"}?`)) return;
    await toggleVendorStatusAction(id, current);
    router.refresh();
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createVendorAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowAddModal(false);
      router.refresh();
    }
  };

  const handleEditOpen = (vendor: VendorItem) => {
    setEditingVendor(vendor);
    setError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await updateVendorAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowEditModal(false);
      setEditingVendor(null);
      router.refresh();
    }
  };

  return (
    <>
      {/* HEADER & ADD BUTTON */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Master Rekanan / Vendor / Subkon</h2>
          <div className="text-xs text-muted">
            Kelola data supplier material, subkontraktor lapangan, dan penyedia jasa lintas proyek
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setError(null);
            setShowAddModal(true);
          }}
        >
          ➕ Tambah Vendor Baru
        </button>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="card p-3">
          <div className="text-xs text-muted font-medium">Total Vendor</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-muted font-medium">Supplier Material</div>
          <div className="text-xl font-bold text-blue-600 mt-1">{stats.suppliers}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-muted font-medium">Subkontraktor</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{stats.subcontractors}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-muted font-medium">Penyedia Jasa</div>
          <div className="text-xl font-bold text-purple-600 mt-1">{stats.services}</div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="card mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1" style={{ minWidth: 240 }}>
            <input
              type="text"
              placeholder="🔍 Cari nama vendor, kode, telepon, atau alamat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-medium">Tipe:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="form-control text-sm"
              style={{ width: "auto" }}
            >
              <option value="ALL">Semua Tipe</option>
              <option value="SUPPLIER">Supplier Material</option>
              <option value="SUBCONTRACTOR">Subkontraktor</option>
              <option value="SERVICE">Vendor Jasa</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-control text-sm"
              style={{ width: "auto" }}
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Non-Aktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="card">
        <div className="card-body-flush">
          {filteredVendors.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <div className="text-sm font-semibold mb-1">Tidak ada data vendor</div>
              <div className="text-xs">
                {searchTerm || selectedType !== "ALL" || selectedStatus !== "ALL"
                  ? "Coba ubah filter pencarian Anda."
                  : "Belum ada vendor terdaftar. Klik 'Tambah Vendor Baru' di atas."}
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Kode</th>
                  <th>Nama Vendor / Rekanan</th>
                  <th>Tipe Vendor</th>
                  <th>Kontak & Alamat</th>
                  <th className="text-center">Status</th>
                  <th className="text-center" style={{ width: 140 }}>
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => {
                  const typeCfg = vendorTypeConfig[vendor.type];
                  return (
                    <tr key={vendor.id}>
                      <td className="col-mono font-semibold">
                        {vendor.code || <span className="text-muted font-normal text-xs">-</span>}
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">{vendor.name}</div>
                        {vendor.notes && (
                          <div className="text-xs text-muted truncate mt-0.5" style={{ maxWidth: 280 }}>
                            {vendor.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium border"
                          style={{
                            background: typeCfg.bg,
                            color: typeCfg.color,
                            borderColor: typeCfg.border,
                          }}
                        >
                          {typeCfg.label}
                        </span>
                      </td>
                      <td>
                        <div className="text-xs text-slate-800">
                          {vendor.phone ? `📞 ${vendor.phone}` : <span className="text-muted">-</span>}
                        </div>
                        {vendor.address && (
                          <div className="text-xs text-muted truncate mt-0.5" style={{ maxWidth: 220 }}>
                            📍 {vendor.address}
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <span
                          className={`status ${vendor.isActive ? "status-success" : "status-neutral"}`}
                        >
                          <span className="status-dot"></span>
                          {vendor.isActive ? "Aktif" : "Non-Aktif"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            onClick={() => handleEditOpen(vendor)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            onClick={() => handleToggleStatus(vendor.id, vendor.isActive)}
                          >
                            {vendor.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL TAMBAH VENDOR */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Tambah Vendor Baru</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Kode Vendor</label>
                    <input
                      type="text"
                      name="code"
                      placeholder="Contoh: VND-01"
                      className="form-control"
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Tipe Vendor</label>
                    <select name="type" className="form-control" defaultValue="SUPPLIER" required>
                      <option value="SUPPLIER">Supplier Material</option>
                      <option value="SUBCONTRACTOR">Subkontraktor</option>
                      <option value="SERVICE">Vendor Jasa</option>
                    </select>
                  </div>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label required">Nama Vendor / Rekanan</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Contoh: TB. Makmur Sentosa"
                    className="form-control"
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Nomor Kontak / Telepon</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="Contoh: 0812-3456-7890"
                    className="form-control"
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Alamat</label>
                  <textarea
                    name="address"
                    rows={2}
                    className="form-control"
                    placeholder="Alamat kantor / gudang / workshop..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <textarea
                    name="notes"
                    rows={2}
                    className="form-control"
                    placeholder="Keterangan tambahan..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT VENDOR */}
      {showEditModal && editingVendor && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Edit Vendor: {editingVendor.name}</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingVendor(null);
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <input type="hidden" name="id" value={editingVendor.id} />
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="form-group">
                    <label className="form-label">Kode Vendor</label>
                    <input
                      type="text"
                      name="code"
                      defaultValue={editingVendor.code || ""}
                      placeholder="Contoh: VND-01"
                      className="form-control"
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Tipe Vendor</label>
                    <select
                      name="type"
                      className="form-control"
                      defaultValue={editingVendor.type}
                      required
                    >
                      <option value="SUPPLIER">Supplier Material</option>
                      <option value="SUBCONTRACTOR">Subkontraktor</option>
                      <option value="SERVICE">Vendor Jasa</option>
                    </select>
                  </div>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label required">Nama Vendor / Rekanan</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingVendor.name}
                    className="form-control"
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Nomor Kontak / Telepon</label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingVendor.phone || ""}
                    placeholder="Contoh: 0812-3456-7890"
                    className="form-control"
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Alamat</label>
                  <textarea
                    name="address"
                    rows={2}
                    defaultValue={editingVendor.address || ""}
                    className="form-control"
                    placeholder="Alamat kantor / gudang / workshop..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={editingVendor.notes || ""}
                    className="form-control"
                    placeholder="Keterangan tambahan..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingVendor(null);
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
    </>
  );
}
