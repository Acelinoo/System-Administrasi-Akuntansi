"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/utils/format";
import {
  createExpenseItemDetailAction,
  deleteExpenseItemDetailAction,
} from "../../actions/project-360.actions";

interface VendorLookup {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface DetailItem {
  id: string;
  itemName: string;
  quantity: any;
  unit: string;
  unitPrice: any;
  totalPrice: any;
  vendorId?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
  vendor?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}

interface Props {
  accItemId: string;
  projectId: string;
  noKas: string;
  description: string;
  approvedAmount: number;
  itemDetails: DetailItem[];
  vendors: VendorLookup[];
}

export default function AccMaterialDetailsSection({
  accItemId,
  projectId,
  noKas,
  description,
  approvedAmount,
  itemDetails,
  vendors,
}: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic price calculation
  const [qty, setQty] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  const totalCalculated = Math.max(0, qty * unitPrice);

  const totalDetailsAmount = itemDetails.reduce(
    (sum, d) => sum + Number(d.totalPrice || 0),
    0
  );

  const handleOpenModal = () => {
    setErrorMsg(null);
    setQty(1);
    setUnitPrice(0);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    const res = await createExpenseItemDetailAction(formData);
    setLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setShowModal(false);
      router.refresh();
    }
  };

  const handleDeleteDetail = async (detailId: string, itemName: string) => {
    if (!confirm(`Hapus rincian barang '${itemName}'?`)) return;
    setLoading(true);
    const formData = new FormData();
    formData.set("detailId", detailId);
    formData.set("accItemId", accItemId);
    formData.set("projectId", projectId);

    const res = await deleteExpenseItemDetailAction(formData);
    setLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <div>
            <h2>Rincian Barang & Material Pembelian</h2>
            <div className="text-xs text-muted">
              Rincian kuantitas, satuan, harga satuan, dan toko vendor yang terkait dengan voucher pengeluaran ini
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted font-medium">
              {itemDetails.length} rincian barang (Total: {formatRupiah(totalDetailsAmount)})
            </span>
            <button
              onClick={handleOpenModal}
              className="btn btn-primary btn-sm"
              style={{ fontSize: "0.76rem" }}
            >
              ➕ Tambah Rincian Material
            </button>
          </div>
        </div>

        <div className="card-body-flush">
          {itemDetails.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Tidak ada rincian material terpisah.</div>
              <div className="empty-state-desc">
                Item pengeluaran ini dicatat langsung berdasarkan pagu voucher disetujui (misal: upah tenaga kerja, sewa alat, atau operasional kantor). Klik tombol di atas untuk merinci barang material bila ada nota toko.
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Barang / Material</th>
                  <th className="text-right">Kuantitas</th>
                  <th>Satuan</th>
                  <th className="text-right">Harga Satuan (Rp)</th>
                  <th className="text-right">Total Harga (Rp)</th>
                  <th>Vendor / Toko</th>
                  <th>No. Bukti / Ref</th>
                  <th className="text-center" style={{ width: 80 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {itemDetails.map((det) => (
                  <tr key={det.id}>
                    <td className="font-medium text-slate-900">
                      <div>{det.itemName}</div>
                      {det.notes && <div className="text-[11px] text-muted">{det.notes}</div>}
                    </td>
                    <td className="col-num text-sm">{Number(det.quantity).toLocaleString("id-ID")}</td>
                    <td className="text-xs text-muted">{det.unit}</td>
                    <td className="col-num text-sm">{formatRupiah(Number(det.unitPrice))}</td>
                    <td className="col-num text-sm font-semibold">{formatRupiah(Number(det.totalPrice))}</td>
                    <td className="text-sm">{det.vendor ? det.vendor.name : "-"}</td>
                    <td className="text-xs col-mono">{det.referenceNo || "-"}</td>
                    <td className="text-center">
                      <button
                        onClick={() => handleDeleteDetail(det.id, det.itemName)}
                        className="btn btn-ghost btn-sm text-danger"
                        style={{ fontSize: "0.72rem", padding: "2px 6px" }}
                        title="Hapus rincian barang"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL TAMBAH RINCIAN MATERIAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h2>Tambah Rincian Material / Barang</h2>
                <div className="text-xs text-muted">
                  Catat item pembelian bahan bangunan atau material proyek
                </div>
              </div>
              <button onClick={handleCloseModal} className="modal-close">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="accItemId" value={accItemId} />

              <div className="modal-body">
                {errorMsg && <div className="alert alert-error mb-4">{errorMsg}</div>}

                <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 mb-3">
                  Voucher ACC: <strong>{noKas}</strong> — {description}  
                  <br />
                  <span className="text-muted">Pagu Disetujui: {formatRupiah(approvedAmount)}</span>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label required">
                    Nama Barang / Material <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    required
                    placeholder="Contoh: Semen Tiga Roda 50kg, Besi 10mm Ulir, Cat Dulux Pentalite"
                    className="form-control"
                  />
                  <div className="text-xs text-muted mt-1">Masukkan nama barang secara spesifik beserta ukuran/merek</div>
                </div>

                <div className="grid-3 mb-3">
                  <div className="form-group">
                    <label className="form-label required">
                      Kuantitas <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      name="quantity"
                      value={qty}
                      onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                      required
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">
                      Satuan <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="unit"
                      defaultValue="sak"
                      required
                      placeholder="sak, btg, m3, kg, bh"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">
                      Harga Satuan (Rp) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      name="unitPrice"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                      required
                      placeholder="0"
                      className="form-control"
                    />
                  </div>
                </div>

                {/* Subtotal Preview */}
                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded mb-3 flex justify-between items-center">
                  <span className="text-xs font-semibold text-blue-900">Total Harga Barang:</span>
                  <span className="text-sm font-bold text-blue-700">{formatRupiah(totalCalculated)}</span>
                </div>

                <div className="grid-2 mb-3">
                  <div className="form-group">
                    <label className="form-label">Vendor / Toko (Opsional)</label>
                    <select name="vendorId" className="form-control" defaultValue="NONE">
                      <option value="NONE">-- Beli Langsung / Toko Umum --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.type})
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-muted mt-1">Pilih supplier toko jika barang dipasok rekanan</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. Bukti / Nota (Opsional)</label>
                    <input
                      type="text"
                      name="referenceNo"
                      placeholder="Contoh: NOTA-2026/04"
                      className="form-control"
                    />
                    <div className="text-xs text-muted mt-1">Nomor struk/nota fisik pembelian</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan Tambahan (Opsional)</label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Keterangan spesifikasi, lokasi penempatan, atau informasi bon..."
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || qty <= 0 || unitPrice < 0}
                  className="btn btn-primary"
                >
                  {loading ? "Menyimpan..." : "Simpan Rincian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
