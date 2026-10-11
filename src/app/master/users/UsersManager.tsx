"use client";

import { useState } from "react";
import {
  createUserAction,
  updateUserAction,
  resetUserPasswordAction,
  toggleUserActiveAction,
} from "@/app/actions/user.actions";
import { useRouter } from "next/navigation";

interface UserItem {
  id: string;
  username: string;
  fullName: string;
  role: "STAFF" | "ADMIN";
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: {
    submissionBatches: number;
    fundInflows: number;
    disbursements: number;
  };
}

export default function UsersManager({
  users,
  currentUserId,
}: {
  users: UserItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [resettingUser, setResettingUser] = useState<UserItem | null>(null);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states for Create
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"STAFF" | "ADMIN">("STAFF");

  // Form state for Reset Password
  const [newPasswordForReset, setNewPasswordForReset] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("username", newUsername);
    formData.set("fullName", newFullName);
    formData.set("password", newPassword);
    formData.set("role", newRole);

    const result = await createUserAction(formData);
    setLoading(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: `Pengguna '${newUsername}' berhasil dibuat.` });
      setShowCreateModal(false);
      setNewUsername("");
      setNewFullName("");
      setNewPassword("");
      router.refresh();
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("userId", editingUser.id);
    formData.set("fullName", editingUser.fullName);
    formData.set("role", editingUser.role);
    formData.set("isActive", editingUser.isActive ? "true" : "false");

    const result = await updateUserAction(formData);
    setLoading(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: `Pengguna '${editingUser.username}' berhasil diperbarui.` });
      setEditingUser(null);
      router.refresh();
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("userId", resettingUser.id);
    formData.set("newPassword", newPasswordForReset);

    const result = await resetUserPasswordAction(formData);
    setLoading(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: `Password untuk pengguna '${resettingUser.username}' berhasil diperbarui.`,
      });
      setResettingUser(null);
      setNewPasswordForReset("");
      router.refresh();
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    if (!confirm(`Apakah Anda yakin ingin ${user.isActive ? "menonaktifkan" : "mengaktifkan"} akun '${user.username}'?`)) {
      return;
    }

    const result = await toggleUserActiveAction(user.id);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: `Status akun '${user.username}' diubah menjadi ${result.isActive ? "Aktif" : "Nonaktif"}.`,
      });
      router.refresh();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>
            Kelola Pengguna & Hak Akses
          </h1>
          <p className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 4, marginBottom: 0 }}>
            Manajemen akun pengguna, peran otorisasi (ADMIN / STAFF), dan reset password.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          ➕ Tambah Pengguna Baru
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-4)",
            fontSize: "0.85rem",
            background: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: message.type === "success" ? "#065f46" : "var(--color-danger)",
            border: `1px solid ${message.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}
        >
          {message.text}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Nama Lengkap</th>
              <th>Peran (Role)</th>
              <th>Status</th>
              <th>Login Terakhir</th>
              <th>Aktivitas Terkait</th>
              <th style={{ textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <td>
                    <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                      {u.username}
                    </span>
                    {isSelf && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: "0.7rem",
                          background: "var(--color-bg-subtle)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        (Anda)
                      </span>
                    )}
                  </td>
                  <td>{u.fullName}</td>
                  <td>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: u.role === "ADMIN" ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                        color: u.role === "ADMIN" ? "#047857" : "#1d4ed8",
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: u.isActive ? "#10b981" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {u.isActive ? "● Aktif" : "○ Nonaktif"}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("id-ID") : "Belum pernah"}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {u._count.submissionBatches + u._count.fundInflows + u._count.disbursements} transaksi
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        onClick={() => setEditingUser(u)}
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setResettingUser(u)}
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        🔑 Reset Pwd
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={u.isActive ? "btn btn-danger" : "btn btn-secondary"}
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                        >
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah Pengguna */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: "var(--space-5)" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 16px 0" }}>
              Tambah Pengguna Baru
            </h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: stafkasir"
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Contoh: Rina (Kasir Proyek)"
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  Peran (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "STAFF" | "ADMIN")}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                >
                  <option value="STAFF">STAFF (Kasir / Administrasi Operasional)</option>
                  <option value="ADMIN">ADMIN (Pimpinan / Full Access)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  Password Awal (Min 8 Karakter)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Pengguna */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: "var(--space-5)" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 16px 0" }}>
              Edit Pengguna: {editingUser.username}
            </h2>
            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  Peran (Role)
                </label>
                <select
                  value={editingUser.role}
                  disabled={editingUser.id === currentUserId}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as "STAFF" | "ADMIN" })
                  }
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                >
                  <option value="STAFF">STAFF</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                {editingUser.id === currentUserId && (
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    Tidak dapat mengubah role akun sendiri.
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editingUser.isActive}
                    disabled={editingUser.id === currentUserId}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                  />
                  <span>Akun Aktif (Dapat Login)</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Perbarui Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resettingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: "var(--space-5)" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 16px 0" }}>
              Reset Password: {resettingUser.username}
            </h2>
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  Password Baru (Min 8 Karakter)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPasswordForReset}
                  onChange={(e) => setNewPasswordForReset(e.target.value)}
                  placeholder="••••••••"
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setResettingUser(null);
                    setNewPasswordForReset("");
                  }}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Password Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
