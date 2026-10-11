"use client";

import { useState } from "react";
import { loginAction } from "@/app/actions/auth.actions";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm({ hasAdmin }: { hasAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("username", username);
      formData.set("password", password);

      const result = await loginAction(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        router.push(returnTo);
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat mencoba login.");
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div
        className="card"
        style={{
          padding: "var(--space-6)",
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
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
              background: "linear-gradient(135deg, var(--color-primary), #1e40af)",
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: 800,
              marginBottom: "var(--space-3)",
            }}
          >
            PT
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
            ProTrack Portal
          </h1>
          <p
            className="text-secondary"
            style={{ fontSize: "0.85rem", marginTop: 4, marginBottom: 0 }}
          >
            Sistem Administrasi & Akuntansi Proyek
          </p>
        </div>

        {!hasAdmin && (
          <div
            style={{
              padding: "var(--space-3)",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-4)",
              fontSize: "0.85rem",
              color: "#b45309",
            }}
          >
            ⚠️ <strong>Setup Awal:</strong> Belum ada akun Administrator yang terdaftar.{" "}
            <a
              href="/setup-admin"
              style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "underline" }}
            >
              Klik di sini untuk membuat akun Admin pertama.
            </a>
          </div>
        )}

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
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
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
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
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
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading ? "Memverifikasi..." : "Masuk ke Sistem 🔐"}
          </button>
        </form>

        <div
          style={{
            marginTop: "var(--space-5)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--color-border-subtle)",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
          }}
        >
          Sistem terproteksi otorisasi server-side. Seluruh aktivitas audit tercatat.
        </div>
      </div>
    </div>
  );
}
