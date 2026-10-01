"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  collapsible?: boolean;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { href: "/", label: "Dashboard", icon: "📊" },
    ],
  },
  {
    label: "TRANSAKSI",
    items: [
      { href: "/acc", label: "Data ACC", icon: "📋" },
      { href: "/inflows", label: "Dana Masuk", icon: "💰" },
      { href: "/disbursements", label: "Realisasi", icon: "💸" },
    ],
  },
  {
    label: "MONITORING",
    items: [
      { href: "/reports/projects", label: "Proyek", icon: "🏗️" },
      { href: "/pic", label: "PIC", icon: "👷" },
    ],
  },
  {
    label: "KEUANGAN",
    items: [
      { href: "/journals", label: "Jurnal", icon: "📒" },
      { href: "/reports", label: "Laporan", icon: "📈" },
    ],
  },
  {
    label: "EXPORT",
    items: [
      { href: "/export", label: "Export", icon: "📦" },
    ],
  },
  {
    label: "MASTER DATA",
    collapsible: true,
    items: [
      { href: "/master/projects", label: "Proyek", icon: "🏗️" },
      { href: "/master/categories", label: "Kategori", icon: "🏷️" },
      { href: "/master/pic", label: "PIC", icon: "👤" },
      { href: "/master/accounts", label: "Kas & Bank", icon: "🏦" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [masterExpanded, setMasterExpanded] = useState(true);

  // Auto-expand Master Data if current path is within /master
  useEffect(() => {
    if (pathname.startsWith("/master")) {
      setMasterExpanded(true);
    }
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/reports") {
      return pathname.startsWith("/reports") && !pathname.startsWith("/reports/projects");
    }
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
          {navSections.map((section) => {
            const isCollapsible = !!section.collapsible;
            const isSectionActive = section.items.some((item) => isActive(item.href));

            return (
              <div key={section.label} className="mb-2">
                {isCollapsible ? (
                  <button
                    type="button"
                    onClick={() => setMasterExpanded(!masterExpanded)}
                    className="sidebar-section-label"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px 12px",
                      color: isSectionActive ? "var(--color-primary, #2563eb)" : "inherit",
                    }}
                  >
                    <span>{section.label}</span>
                    <span style={{ fontSize: "0.65rem", transition: "transform 0.2s" }}>
                      {masterExpanded ? "▼" : "▶"}
                    </span>
                  </button>
                ) : (
                  <div className="sidebar-section-label">{section.label}</div>
                )}

                {(!isCollapsible || masterExpanded) && (
                  <div>
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
                )}
              </div>
            );
          })}
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
