"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error captured by boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "var(--space-8)",
      }}
    >
      <div
        style={{
          fontSize: "3rem",
          marginBottom: "var(--space-3)",
        }}
      >
        ⚠️
      </div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
        Terjadi Kesalahan Sistem
      </h1>
      <p
        className="text-secondary"
        style={{ maxWidth: 520, marginBottom: "var(--space-4)", fontSize: "0.9rem" }}
      >
        Aplikasi mengalami kendala tak terduga saat memproses data. Integritas data finansial tetap aman di database.
      </p>

      {error.message && (
        <div
          className="card mb-6"
          style={{
            maxWidth: 620,
            background: "var(--color-bg-subtle)",
            padding: "var(--space-3) var(--space-4)",
            textAlign: "left",
            fontSize: "0.8rem",
            color: "var(--color-danger)",
            fontFamily: "var(--font-mono)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {error.message.includes("#441")
              ? "React Error #441 — Server Component Render Failure"
              : "Detail Kesalahan:"}
          </div>
          <div style={{ wordBreak: "break-word" }}>{error.message}</div>
          {error.digest && (
            <div style={{ marginTop: 8, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Server Digest ID: <code>{error.digest}</code>
            </div>
          )}
          {error.message.includes("#441") && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px dashed var(--color-border)",
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
              }}
            >
              💡 <strong>Diagnostik:</strong> Error #441 terjadi saat Server Component gagal merender di server. Penyebab paling umum adalah koneksi database terputus atau <code>DATABASE_URL</code> belum terkonfigurasi di environment Vercel.
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => reset()} className="btn btn-primary">
          🔄 Coba Muat Ulang
        </button>
        <Link href="/" className="btn btn-secondary">
          🏠 Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
