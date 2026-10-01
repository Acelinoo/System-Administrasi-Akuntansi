"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/master/projects", label: "Proyek & Sub-Unit" },
  { href: "/master/categories", label: "Kategori Biaya" },
  { href: "/master/pic", label: "PIC Lapangan" },
  { href: "/master/accounts", label: "Kas & Bank" },
];

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Master Data Referensi</h1>
          <div className="page-header-subtitle">
            Kelola master data proyek, kategori biaya, penanggung jawab, dan rekening kas operasional
          </div>
        </div>
      </div>

      <div className="page-body">
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
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
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
