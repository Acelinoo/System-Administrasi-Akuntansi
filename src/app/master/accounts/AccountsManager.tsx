"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCashAccountAction,
  toggleCashAccountStatusAction,
} from "../../actions/master.actions";
import { formatRupiah } from "@/lib/utils/format";

interface CashAccountItem {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: "CASH" | "BANK";
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  openingBalance: unknown;
  isActive: boolean;
  _count: { fundInflows: number; disbursements: number };
}

export default function AccountsManager({ accounts }: { accounts: CashAccountItem[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"CASH" | "BANK">("BANK");

  const handleToggleStatus = async (id: string, current: boolean) => {
    if (!confirm(`Ubah status akun menjadi ${current ? "NON-AKTIF" : "AKTIF"}?`)) return;
    await toggleCashAccountStatusAction(id, current);
    router.refresh();
  };

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createCashAccountAction(formData);
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
          <h2 className="text-base font-semibold">Daftar Akun Kas & Bank</h2>
          <div className="text-xs text-muted">
            Rekening bank dan kas fisik operasional untuk penerimaan dan pencairan dana
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setShowModal(true);
            setError(null);
          }}
        >
          ➕ Tambah Akun Baru
        </button>
      </div>

      <div className="card">
        <div className="card-body-flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th>Rincian Bank / Rekening</th>
                <th className="text-right">Saldo Awal</th>
                <th className="text-center">Total Transaksi</th>
                <th className="text-center">Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td className="col-mono font-semibold">{acc.accountCode}</td>
                  <td className="font-medium">{acc.accountName}</td>
                  <td>
                    <span
                      className={`status ${acc.accountType === "BANK" ? "status-info" : "status-warning"}`}
                      style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                    >
                      {acc.accountType === "BANK" ? "🏦 BANK" : "💵 CASH (TUNAI)"}
                    </span>
                  </td>
                  <td className="text-sm">
                    {acc.accountType === "BANK" ? (
                      <div>
                        <span className="font-medium">{acc.bankName}</span>{" "}
                        <span className="col-mono text-muted">{acc.accountNumber}</span>
                        {acc.accountHolder && (
                          <div className="text-xs text-muted">a.n. {acc.accountHolder}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Kas fisik operasional</span>
                    )}
                  </td>
                  <td className="col-num font-semibold">
                    {formatRupiah(Number(acc.openingBalance))}
                  </td>
                  <td className="text-center text-sm">
                    <span title="Penerimaan">{acc._count.fundInflows} Masuk</span>
                    {" / "}
                    <span title="Pencairan">{acc._count.disbursements} Keluar</span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`status ${acc.isActive ? "status-success" : "status-neutral"}`}
                    >
                      <span className="status-dot"></span>
                      {acc.isActive ? "Aktif" : "Non-Aktif"}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      onClick={() => handleToggleStatus(acc.id, acc.isActive)}
                    >
                      {acc.isActive ? "Non-aktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Account */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Tambah Akun Kas & Bank Baru</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddAccount}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                <div className="form-group mb-3">
                  <label className="form-label required">Tipe Akun</label>
                  <select
                    name="accountType"
                    className="form-control"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as "CASH" | "BANK")}
                    required
                  >
                    <option value="BANK">Bank Account (Rekening Bank)</option>
                    <option value="CASH">Cash Account (Kas Tunai Pegangan)</option>
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label required">Kode Akun</label>
                  <input
                    type="text"
                    name="accountCode"
                    required
                    placeholder="Contoh: MANDIRI_CBS, KAS_NISA"
                    className="form-control"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label required">Nama Akun</label>
                  <input
                    type="text"
                    name="accountName"
                    required
                    placeholder="Contoh: Mandir CBS 131-00-xxxx, Kas Tunai Nisa"
                    className="form-control"
                  />
                </div>

                {accountType === "BANK" && (
                  <>
                    <div className="form-group mb-3">
                      <label className="form-label">Nama Bank</label>
                      <input
                        type="text"
                        name="bankName"
                        placeholder="Contoh: Bank Mandiri, BCA, BRI"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group mb-3">
                      <label className="form-label">Nomor Rekening</label>
                      <input
                        type="text"
                        name="accountNumber"
                        placeholder="Contoh: 131-00-1234567-8"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group mb-3">
                      <label className="form-label">Atas Nama Rekening</label>
                      <input
                        type="text"
                        name="accountHolder"
                        placeholder="Contoh: PT Bangun Cipta Sejahtera"
                        className="form-control"
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Saldo Awal (Opening Balance)</label>
                  <input
                    type="number"
                    name="openingBalance"
                    step="0.01"
                    defaultValue="0"
                    placeholder="0"
                    className="form-control"
                  />
                  <div className="form-hint">Saldo awal sebelum pencatatan transaksi sistem</div>
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
                  {loading ? "Menyimpan..." : "Simpan Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
