import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ProTrack — Administrasi Keuangan Proyek",
  description:
    "Sistem pencatatan administrasi keuangan proyek internal. Rekap pengajuan ACC, pencairan dana, dan jurnal akuntansi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
