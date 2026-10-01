"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const reportTabs = [
  { href: "/reports/acc", label: "Rekap Data ACC" },
  { href: "/reports/realization", label: "Realisasi Pencairan" },
  { href: "/reports/projects", label: "Per Proyek" },
  { href: "/reports/pic", label: "Per PIC Lapangan" },
  { href: "/reports/cash", label: "Kas & Bank" },
  { href: "/reports/journals", label: "Buku Jurnal" },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Laporan & Rekapitulasi Operasional</h1>
          <div className="page-header-subtitle">
            Pusat laporan administrasi keuangan proyek, realisasi pengeluaran, posisi kas, dan audit akuntansi
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Navigation Tabs Bar */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "#ffffff",
            padding: "6px 8px",
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
            marginBottom: 20,
            overflowX: "auto",
          }}
        >
          {reportTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
                style={{
                  textDecoration: "none",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.8rem",
                  padding: "6px 14px",
                  borderRadius: "6px",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </>
  );
}
