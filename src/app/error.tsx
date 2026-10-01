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
            maxWidth: 600,
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
          {error.message}
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
