"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voidDisbursementAction } from "@/app/actions/disbursement.actions";

export default function VoidDisbursementButton({
  disbursementId,
  disbursementNumber,
}: {
  disbursementId: string;
  disbursementNumber: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setError("Alasan pembatalan (void) wajib diisi minimal 5 karakter.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("disbursementId", disbursementId);
    formData.append("voidReason", voidReason);

    try {
      const res = await voidDisbursementAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        setIsOpen(false);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat membatalkan pencairan.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-danger"
        onClick={() => {
          setIsOpen(true);
          setError(null);
        }}
      >
        Batalkan Pencairan (VOID)
      </button>

      {isOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Konfirmasi Pembatalan (VOID)</h3>
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
                  <strong>Peringatan:</strong> Tindakan ini akan membatalkan pencairan{" "}
                  <strong>{disbursementNumber}</strong>. Saldo kas akan dikembalikan,
                  status ACC akan dihitung ulang, dan jurnal terkait akan berstatus VOID.
                </div>

                {error && <div className="alert alert-error mb-4">{error}</div>}

                <div className="form-group">
                  <label className="form-label required">Alasan Pembatalan (VOID)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Contoh: Salah input rekening pembayaran / transaksi dibatalkan atas arahan atasan"
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
                  {loading ? "Memproses..." : "Ya, Batalkan Transaksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
