"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDisbursementAction } from "../../actions/disbursement.actions";

interface OutstandingItem {
  id: string;
  noKas: string;
  description: string;
  projectCode: string;
  projectName: string;
  picName: string;
  categoryName: string;
  approvedAmount: number;
  realizedAmount: number;
  outstanding: number;
  status: string;
}

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
}

interface Balances {
  accounts: { accountId: string; currentBalance: number }[];
  totalLiquidity: number;
}

interface SelectedItem {
  accItemId: string;
  realizedAmount: string;
}

export default function DisbursementNewForm({
  outstandingItems,
  accounts,
  balances,
}: {
  outstandingItems: OutstandingItem[];
  accounts: Account[];
  balances: Balances;
}) {
  const router = useRouter();
  const [disbDate, setDisbDate] = useState(new Date().toISOString().slice(0, 10));
  const [cashAccountId, setCashAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleItem = (id: string, outstanding: number) => {
    const exists = selectedItems.find((s) => s.accItemId === id);
    if (exists) {
      setSelectedItems(selectedItems.filter((s) => s.accItemId !== id));
    } else {
      setSelectedItems([
        ...selectedItems,
        { accItemId: id, realizedAmount: outstanding.toString() },
      ]);
    }
  };

  const updateItemAmount = (accItemId: string, value: string) => {
    setSelectedItems(
      selectedItems.map((s) =>
        s.accItemId === accItemId ? { ...s, realizedAmount: value } : s
      )
    );
  };

  const total = selectedItems.reduce(
    (sum, s) => sum + (parseFloat(s.realizedAmount) || 0),
    0
  );

  const selectedBalance = balances.accounts.find(
    (b) => b.accountId === cashAccountId
  )?.currentBalance ?? 0;

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setError("Pilih minimal 1 item ACC untuk dicairkan.");
      return;
    }
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const items = selectedItems.map((s) => ({
      accItemId: s.accItemId,
      realizedAmount: parseFloat(s.realizedAmount),
    }));

    const formData = new FormData();
    formData.set("disbursementDate", disbDate);
    formData.set("cashAccountId", cashAccountId);
    formData.set("paymentMethod", paymentMethod);
    formData.set("totalRealizedAmount", total.toString());
    formData.set("notes", notes);
    formData.set("items", JSON.stringify(items));

    try {
      const result = await createDisbursementAction(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Pencairan berhasil. Total: ${formatRp(result.total!)}`);
        setTimeout(() => router.push("/disbursements"), 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Payment Settings */}
      <div className="card mb-6">
        <div className="card-header">
          <h2>Pengaturan Pembayaran</h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tanggal Pencairan *</label>
              <input
                type="date"
                className="form-input"
                value={disbDate}
                onChange={(e) => setDisbDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Akun Pembayar *</label>
              <select
                className="form-select"
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                required
              >
                <option value="">Pilih akun kas/bank...</option>
                {accounts.map((a) => {
                  const bal = balances.accounts.find((b) => b.accountId === a.id);
                  return (
                    <option key={a.id} value={a.id}>
                      {a.accountName} — Saldo: {formatRp(bal?.currentBalance ?? 0)}
                    </option>
                  );
                })}
              </select>
              {cashAccountId && (
                <div className="form-hint">
                  Saldo tersedia: <strong>{formatRp(selectedBalance)}</strong>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Metode Pembayaran *</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              >
                <option value="CASH">Tunai (Cash)</option>
                <option value="TRANSFER">Transfer Bank</option>
                <option value="GIRO">Giro / Cek</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Catatan</label>
            <input
              type="text"
              className="form-input"
              placeholder="Catatan opsional..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Item Selection */}
      <div className="card mb-6">
        <div className="card-header">
          <h2>Pilih Item ACC untuk Dicairkan</h2>
          <span className="text-sm text-secondary">
            {outstandingItems.length} item outstanding
          </span>
        </div>
        <div className="card-body-flush">
          {outstandingItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">Semua item sudah lunas</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>No Kas</th>
                    <th>Proyek</th>
                    <th>Uraian</th>
                    <th>PIC</th>
                    <th className="text-right">ACC</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-right" style={{ width: 140 }}>
                      Cairkan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingItems.map((item) => {
                    const selected = selectedItems.find(
                      (s) => s.accItemId === item.id
                    );
                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: selected ? "var(--blue-50)" : undefined,
                        }}
                      >
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={() => toggleItem(item.id, item.outstanding)}
                          />
                        </td>
                        <td className="col-mono">{item.noKas}</td>
                        <td className="text-sm font-medium">{item.projectCode}</td>
                        <td
                          className="truncate"
                          style={{ maxWidth: 180 }}
                          title={item.description}
                        >
                          {item.description}
                        </td>
                        <td className="text-sm">{item.picName}</td>
                        <td className="col-num">{formatRp(item.approvedAmount)}</td>
                        <td className="col-num" style={{ color: "var(--amber-700)" }}>
                          {formatRp(item.outstanding)}
                        </td>
                        <td>
                          {selected ? (
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max={item.outstanding}
                              step="1"
                              value={selected.realizedAmount}
                              onChange={(e) =>
                                updateItemAmount(item.id, e.target.value)
                              }
                              style={{
                                textAlign: "right",
                                padding: "4px 8px",
                                fontSize: "0.8rem",
                              }}
                            />
                          ) : (
                            <span className="text-muted text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Summary + Submit */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-secondary">
                {selectedItems.length} item dipilih
              </span>
              <div className="text-xs text-muted mt-1">
                {cashAccountId && total > selectedBalance && (
                  <span style={{ color: "var(--red-600)", fontWeight: 600 }}>
                    ⚠ Saldo tidak mencukupi!
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-secondary">Total Pencairan</div>
                <div className="font-bold tabular-nums" style={{ fontSize: "1.1rem" }}>
                  {formatRp(total)}
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || selectedItems.length === 0}
              >
                {submitting ? "Memproses..." : "Proses Pencairan"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
