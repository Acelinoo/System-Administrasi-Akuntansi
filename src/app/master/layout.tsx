"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/master/projects", label: "Proyek & Sub-Unit", icon: "🏗️" },
  { href: "/master/categories", label: "Kategori Biaya", icon: "🏷️" },
  { href: "/master/pic", label: "PIC Lapangan", icon: "👷" },
  { href: "/master/accounts", label: "Kas & Bank", icon: "🏦" },
  { href: "/master/coa", label: "Chart of Accounts (COA)", icon: "📒" },
];

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Master Data Referensi</h1>
          <div className="page-header-subtitle">
            Kelola master data proyek, kategori biaya, penanggung jawab, rekening kas, dan COA akuntansi
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="filter-bar mb-6" style={{ padding: "4px 8px", gap: 8 }}>
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
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
