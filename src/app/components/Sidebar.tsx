"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navSections = [
  {
    label: "UTAMA",
    items: [
      { href: "/", label: "Dashboard", icon: "📊" },
    ],
  },
  {
    label: "TRANSAKSI",
    items: [
      { href: "/acc", label: "Pengajuan ACC", icon: "📋" },
      { href: "/acc/new", label: "Input ACC Baru", icon: "➕" },
      { href: "/acc/import", label: "Impor Data Excel", icon: "📥" },
      { href: "/inflows", label: "Penerimaan Dana", icon: "💰" },
      { href: "/disbursements", label: "Pencairan", icon: "💸" },
    ],
  },
  {
    label: "LAPORAN & MONITORING",
    items: [
      { href: "/reports", label: "Laporan & Export", icon: "📊" },
      { href: "/journals", label: "Jurnal Akuntansi", icon: "📒" },
      { href: "/pic", label: "Distribusi PIC", icon: "👷" },
    ],
  },
  {
    label: "MASTER DATA",
    items: [
      { href: "/master/projects", label: "Proyek & Sub-Unit", icon: "🏗️" },
      { href: "/master/categories", label: "Kategori Biaya", icon: "🏷️" },
      { href: "/master/pic", label: "PIC Lapangan", icon: "👤" },
      { href: "/master/accounts", label: "Kas & Bank", icon: "🏦" },
      { href: "/master/coa", label: "COA Akuntansi", icon: "📑" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        style={{ position: "fixed", top: 12, left: 12, zIndex: 200 }}
      >
        ☰
      </button>

      <aside className={`sidebar${mobileOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">PT</div>
          <div>
            <div className="sidebar-brand-text">ProTrack</div>
            <div className="sidebar-brand-sub">Admin Keuangan</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link${isActive(item.href) ? " active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">S</div>
          <div>
            <div className="sidebar-user-name">Staff Admin</div>
            <div className="sidebar-user-role">Administrasi</div>
          </div>
        </div>
      </aside>
    </>
  );
}
