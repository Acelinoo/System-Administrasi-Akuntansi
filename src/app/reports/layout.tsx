"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const reportTabs = [
  { href: "/reports/acc", label: "Rekap ACC", icon: "📋" },
  { href: "/reports/realization", label: "Realisasi Pencairan", icon: "💸" },
  { href: "/reports/projects", label: "Per Proyek", icon: "🏗️" },
  { href: "/reports/pic", label: "Per PIC", icon: "👷" },
  { href: "/reports/cash", label: "Kas & Bank", icon: "🏦" },
  { href: "/reports/journals", label: "Buku Jurnal", icon: "📒" },
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
        <div className="filter-bar mb-6" style={{ padding: "4px 8px", gap: 8 }}>
          {reportTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                style={{ textDecoration: "none" }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </>
  );
}
