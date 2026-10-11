"use client";

import { useState } from "react";
import { setupAdminAction } from "@/app/actions/auth.actions";
import { useRouter } from "next/navigation";

export default function SetupAdminForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("username", username);
      formData.set("fullName", fullName);
      formData.set("password", password);
      formData.set("confirmPassword", confirmPassword);

      const result = await setupAdminAction(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan saat memproses setup awal.");
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 460 }}>
      <div
        className="card"
        style={{
          padding: "var(--space-6)",
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: 800,
              marginBottom: "var(--space-3)",
            }}
          >
            🛡️
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
            Inisialisasi Administrator Awal
          </h1>
          <p
            className="text-secondary"
            style={{ fontSize: "0.85rem", marginTop: 4, marginBottom: 0 }}
          >
            Buat akun pimpinan/admin pertama untuk mengamankan sistem
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "var(--space-3)",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-4)",
              fontSize: "0.85rem",
              color: "var(--color-danger)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <label
              htmlFor="username"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}
            >
              Username Admin
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: admin atau pagiri"
              className="input-field"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="fullName"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}
            >
              Nama Lengkap Administrator
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Pa Giri (Direktur)"
              className="input-field"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}
            >
              Password (Minimal 8 Karakter)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}
            >
              Ulangi Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "11px",
              fontWeight: 600,
              fontSize: "0.95rem",
              marginTop: "var(--space-2)",
              background: "#059669",
              borderColor: "#059669",
            }}
          >
            {loading ? "Menyimpan Administrator..." : "Sahkan & Aktifkan Administrator 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}
