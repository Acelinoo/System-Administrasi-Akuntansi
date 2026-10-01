import Link from "next/link";

export default function NotFoundPage() {
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
          fontSize: "4rem",
          fontWeight: 800,
          color: "var(--gray-300)",
          lineHeight: 1,
          marginBottom: "var(--space-3)",
        }}
      >
        404
      </div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
        Halaman Tidak Ditemukan
      </h1>
      <p
        className="text-secondary"
        style={{ maxWidth: 460, marginBottom: "var(--space-6)", fontSize: "0.9rem" }}
      >
        Halaman atau dokumen yang Anda cari tidak tersedia atau URL yang dituju salah. Silakan kembali ke Dashboard utama.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="btn btn-primary">
          🏠 Kembali ke Dashboard
        </Link>
        <Link href="/reports/acc" className="btn btn-secondary">
          📋 Buka Laporan ACC
        </Link>
      </div>
    </div>
  );
}
