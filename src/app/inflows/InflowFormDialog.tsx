"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInflowAction } from "../actions/inflow.actions";

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
}

export default function InflowFormDialog({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await createInflowAction(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Catat Penerimaan Dana
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 520, margin: "16px" }}
          >
            <div className="card-header">
              <h2>Penerimaan Dana Baru</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="card-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tanggal *</label>
                    <input
                      type="date"
                      name="inflowDate"
                      className="form-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nominal (Rp) *</label>
                    <input
                      type="number"
                      name="amount"
                      className="form-input"
                      placeholder="0"
                      min="1"
                      step="1"
                      required
                      style={{ textAlign: "right" }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Akun Tujuan *</label>
                  <select name="destinationAccountId" className="form-select" required>
                    <option value="">Pilih akun kas/bank...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountName} ({a.accountType})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Sumber Dana *</label>
                  <input
                    type="text"
                    name="sourceInfo"
                    className="form-input"
                    placeholder="Contoh: Dropping Dana Pa Giri"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">No. Referensi</label>
                  <input
                    type="text"
                    name="referenceNo"
                    className="form-input"
                    placeholder="No. transfer, cek, dll (opsional)"
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "var(--space-4) var(--space-5)",
                  borderTop: "1px solid var(--color-border)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "var(--space-3)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
