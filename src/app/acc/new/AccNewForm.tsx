"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAccBatchAction } from "../../actions/acc.actions";

interface Project {
  id: string;
  code: string;
  name: string;
  subUnits: { id: string; code: string; name: string }[];
}
interface Category {
  id: string;
  code: string;
  name: string;
  subCategories: { id: string; code: string; name: string }[];
}
interface Pic {
  id: string;
  name: string;
}

interface ItemDraft {
  key: number;
  cashType: "KU" | "KT";
  projectId: string;
  subUnitId: string;
  categoryId: string;
  subCategoryId: string;
  picId: string;
  description: string;
  approvedAmount: string;
  notes: string;
}

const emptyItem = (key: number): ItemDraft => ({
  key,
  cashType: "KT",
  projectId: "",
  subUnitId: "",
  categoryId: "",
  subCategoryId: "",
  picId: "",
  description: "",
  approvedAmount: "",
  notes: "",
});

export default function AccNewForm({
  projects,
  categories,
  pics,
}: {
  projects: Project[];
  categories: Category[];
  pics: Pic[];
}) {
  const router = useRouter();
  const [batchCode, setBatchCode] = useState("");
  const [accDate, setAccDate] = useState(new Date().toISOString().slice(0, 10));
  const [approvedByName, setApprovedByName] = useState("Pa Giri");
  const [batchNotes, setBatchNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  let nextKey = items.length + 1;

  const addItem = () => {
    setItems([...items, emptyItem(nextKey++)]);
  };

  const removeItem = (key: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.key !== key));
  };

  const updateItem = (key: number, field: keyof ItemDraft, value: string) => {
    setItems(
      items.map((i) => {
        if (i.key !== key) return i;
        const updated = { ...i, [field]: value };
        // Reset sub selections when parent changes
        if (field === "projectId") updated.subUnitId = "";
        if (field === "categoryId") updated.subCategoryId = "";
        return updated;
      })
    );
  };

  const getSubUnits = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.subUnits ?? [];
  };

  const getSubCategories = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.subCategories ?? [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    // Build items array for service layer
    const parsedItems = items.map((item) => ({
      cashType: item.cashType,
      projectId: item.projectId,
      subUnitId: item.subUnitId || null,
      categoryId: item.categoryId,
      subCategoryId: item.subCategoryId || null,
      picId: item.picId,
      description: item.description,
      approvedAmount: parseFloat(item.approvedAmount),
      notes: item.notes || null,
    }));

    const formData = new FormData();
    formData.set("batchCode", batchCode);
    formData.set("accDate", accDate);
    formData.set("approvedByName", approvedByName);
    formData.set("notes", batchNotes);
    formData.set("items", JSON.stringify(parsedItems));

    try {
      const result = await createAccBatchAction(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Berhasil menyimpan ${result.itemCount} item ACC (Batch: ${batchCode})`);
        setTimeout(() => router.push("/acc"), 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalApproved = items.reduce(
    (sum, i) => sum + (parseFloat(i.approvedAmount) || 0),
    0
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Batch Header */}
      <div className="card mb-6">
        <div className="card-header">
          <h2>Data Batch ACC</h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kode Batch *</label>
              <input
                type="text"
                className="form-input"
                placeholder="BATCH-2026-07-02"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                required
              />
              <div className="form-hint">Format: BATCH-YYYY-MM-DD atau sesuai kebutuhan</div>
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal ACC *</label>
              <input
                type="date"
                className="form-input"
                value={accDate}
                onChange={(e) => setAccDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Atasan Peng-ACC *</label>
              <input
                type="text"
                className="form-input"
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                required
              />
              <div className="form-hint">Atasan pemberi ACC di luar sistem (misal: Pa Giri)</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Catatan Batch</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Catatan opsional untuk batch ini..."
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      {items.map((item, idx) => (
        <div className="card mb-4" key={item.key}>
          <div className="card-header">
            <h2>Item #{idx + 1}</h2>
            {items.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removeItem(item.key)}
                style={{ color: "var(--red-600)" }}
              >
                Hapus
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Jenis Kas *</label>
                <select
                  className="form-select"
                  value={item.cashType}
                  onChange={(e) => updateItem(item.key, "cashType", e.target.value)}
                  required
                >
                  <option value="KT">KT — Kas Terikat (Proyek)</option>
                  <option value="KU">KU — Kas Umum (Operasional)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Proyek *</label>
                <select
                  className="form-select"
                  value={item.projectId}
                  onChange={(e) => updateItem(item.key, "projectId", e.target.value)}
                  required
                >
                  <option value="">Pilih proyek...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {getSubUnits(item.projectId).length > 0 && (
                <div className="form-group">
                  <label className="form-label">Sub Unit</label>
                  <select
                    className="form-select"
                    value={item.subUnitId}
                    onChange={(e) => updateItem(item.key, "subUnitId", e.target.value)}
                  >
                    <option value="">— Tidak ada —</option>
                    {getSubUnits(item.projectId).map((su) => (
                      <option key={su.id} value={su.id}>
                        {su.code} — {su.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori Biaya *</label>
                <select
                  className="form-select"
                  value={item.categoryId}
                  onChange={(e) => updateItem(item.key, "categoryId", e.target.value)}
                  required
                >
                  <option value="">Pilih kategori...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {getSubCategories(item.categoryId).length > 0 && (
                <div className="form-group">
                  <label className="form-label">Sub Kategori</label>
                  <select
                    className="form-select"
                    value={item.subCategoryId}
                    onChange={(e) => updateItem(item.key, "subCategoryId", e.target.value)}
                  >
                    <option value="">— Tidak ada —</option>
                    {getSubCategories(item.categoryId).map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.code} — {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">PIC Lapangan *</label>
                <select
                  className="form-select"
                  value={item.picId}
                  onChange={(e) => updateItem(item.key, "picId", e.target.value)}
                  required
                >
                  <option value="">Pilih PIC...</option>
                  {pics.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Uraian Kebutuhan *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Material pasir 10 truk untuk cor lantai"
                  value={item.description}
                  onChange={(e) => updateItem(item.key, "description", e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nominal ACC (Rp) *</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  min="1"
                  step="1"
                  value={item.approvedAmount}
                  onChange={(e) => updateItem(item.key, "approvedAmount", e.target.value)}
                  required
                  style={{ textAlign: "right" }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan</label>
              <input
                type="text"
                className="form-input"
                placeholder="Catatan opsional..."
                value={item.notes}
                onChange={(e) => updateItem(item.key, "notes", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add item + Submit */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addItem}
        >
          + Tambah Item
        </button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-secondary">
            {items.length} item — Total:{" "}
            <strong className="tabular-nums">
              Rp {totalApproved.toLocaleString("id-ID")}
            </strong>
          </span>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan Data ACC"}
          </button>
        </div>
      </div>
    </form>
  );
}
