"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voidInflowAction } from "@/app/actions/inflow.actions";

export default function VoidInflowButton({
  inflowId,
  inflowNumber,
}: {
  inflowId: string;
  inflowNumber: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim() || voidReason.trim().length < 3) {
      setError("Alasan pembatalan (void) wajib diisi minimal 3 karakter.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("inflowId", inflowId);
    formData.append("voidReason", voidReason);

    try {
      const res = await voidInflowAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        setIsOpen(false);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat membatalkan penerimaan dana.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ fontSize: "0.75rem", padding: "2px 8px", color: "var(--color-danger)" }}
        onClick={() => {
          setIsOpen(true);
          setError(null);
        }}
      >
        Void
      </button>

      {isOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Konfirmasi Pembatalan (VOID) Inflow</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsOpen(false)}
                disabled={loading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="alert alert-error mb-4">
                  <strong>Peringatan:</strong> Tindakan ini akan membatalkan penerimaan dana{" "}
                  <strong>{inflowNumber}</strong>. Saldo kas akan dikurangi kembali dan jurnal terkait akan berstatus VOID.
                </div>

                {error && <div className="alert alert-error mb-4">{error}</div>}

                <div className="form-group">
                  <label className="form-label required">Alasan Pembatalan (VOID)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Contoh: Salah rekening / revisi nominal transfer"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <div className="form-hint">
                    Alasan ini akan dicatat permanen dalam audit trail keuangan.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={loading}
                >
                  {loading ? "Memproses..." : "Ya, Void Inflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
