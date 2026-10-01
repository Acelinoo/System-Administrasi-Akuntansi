"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCoaAccountAction,
  toggleCoaStatusAction,
} from "../../actions/master.actions";
import { CoaType, NormalBalance } from "@prisma/client";

interface CoaItem {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: CoaType;
  normalBalance: NormalBalance;
  isActive: boolean;
  _count: { journalLines: number };
}

export default function CoaManager({ coaList }: { coaList: CoaItem[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleStatus = async (id: string, current: boolean) => {
    if (!confirm(`Ubah status akun COA menjadi ${current ? "NON-AKTIF" : "AKTIF"}?`)) return;
    await toggleCoaStatusAction(id, current);
    router.refresh();
  };

  const handleAddCoa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createCoaAccountAction(formData);
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
          <h2 className="text-base font-semibold">Chart of Accounts (COA)</h2>
          <div className="text-xs text-muted">
            Daftar akun standar akuntansi double-entry untuk pembentukan jurnal otomatis
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setShowModal(true);
            setError(null);
          }}
        >
          ➕ Tambah Akun COA Baru
        </button>
      </div>

      <div className="card">
        <div className="card-body-flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Klasifikasi (Tipe)</th>
                <th>Saldo Normal</th>
                <th className="text-center">Jurnal Terkait</th>
                <th className="text-center">Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {coaList.map((coa) => (
                <tr key={coa.id}>
                  <td className="col-mono font-semibold">{coa.accountCode}</td>
                  <td className="font-medium">{coa.accountName}</td>
                  <td>
                    <span
                      className="status status-neutral"
                      style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                    >
                      {coa.accountType}
                    </span>
                  </td>
                  <td className="text-sm font-semibold">
                    <span
                      style={{
                        color:
                          coa.normalBalance === "DEBIT"
                            ? "var(--color-primary)"
                            : "var(--color-success)",
                      }}
                    >
                      {coa.normalBalance}
                    </span>
                  </td>
                  <td className="text-center text-sm font-medium">
                    {coa._count.journalLines} baris
                  </td>
                  <td className="text-center">
                    <span
                      className={`status ${coa.isActive ? "status-success" : "status-neutral"}`}
                    >
                      <span className="status-dot"></span>
                      {coa.isActive ? "Aktif" : "Non-Aktif"}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      onClick={() => handleToggleStatus(coa.id, coa.isActive)}
                    >
                      {coa.isActive ? "Non-aktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add COA */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Tambah Akun COA Baru</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCoa}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-3">{error}</div>}
                <div className="form-group mb-3">
                  <label className="form-label required">Kode Akun (COA)</label>
                  <input
                    type="text"
                    name="accountCode"
                    required
                    placeholder="Contoh: 1101, 2101, 5101"
                    className="form-control"
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label required">Nama Akun</label>
                  <input
                    type="text"
                    name="accountName"
                    required
                    placeholder="Contoh: Kas Operasional, Beban Material"
                    className="form-control"
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label required">Tipe Akun</label>
                  <select name="accountType" className="form-control" required defaultValue="EXPENSE">
                    <option value="ASSET">ASSET (Aset)</option>
                    <option value="LIABILITY">LIABILITY (Kewajiban)</option>
                    <option value="EQUITY">EQUITY (Modal)</option>
                    <option value="REVENUE">REVENUE (Pendapatan)</option>
                    <option value="EXPENSE">EXPENSE (Beban)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Saldo Normal</label>
                  <select name="normalBalance" className="form-control" required defaultValue="DEBIT">
                    <option value="DEBIT">DEBIT</option>
                    <option value="CREDIT">CREDIT</option>
                  </select>
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
                  {loading ? "Menyimpan..." : "Simpan Akun COA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
