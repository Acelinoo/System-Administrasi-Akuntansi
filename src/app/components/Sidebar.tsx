"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  DashboardIcon,
  DocumentIcon,
  InflowIcon,
  DisbursementIcon,
  ProjectIcon,
  PicIcon,
  JournalIcon,
  ReportIcon,
  ExportIcon,
  CategoryIcon,
  BankIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "./Icons";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  label: string;
  collapsible?: boolean;
  items: NavItem[];
}

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

  const navSections: NavSection[] = [
    {
      label: "OVERVIEW",
      items: [
        { href: "/", label: "Dashboard", icon: <DashboardIcon size={17} /> },
      ],
    },
    {
      label: "TRANSAKSI",
      items: [
        { href: "/acc", label: "Data ACC", icon: <DocumentIcon size={17} /> },
        { href: "/inflows", label: "Dana Masuk", icon: <InflowIcon size={17} /> },
        { href: "/disbursements", label: "Realisasi", icon: <DisbursementIcon size={17} /> },
      ],
    },
    {
      label: "MONITORING",
      items: [
        { href: "/reports/projects", label: "Proyek", icon: <ProjectIcon size={17} /> },
        { href: "/pic", label: "PIC", icon: <PicIcon size={17} /> },
      ],
    },
    {
      label: "KEUANGAN",
      items: [
        { href: "/journals", label: "Jurnal", icon: <JournalIcon size={17} /> },
        { href: "/reports", label: "Laporan", icon: <ReportIcon size={17} /> },
      ],
    },
    {
      label: "EXPORT",
      items: [
        { href: "/export", label: "Export", icon: <ExportIcon size={17} /> },
      ],
    },
    {
      label: "MASTER DATA",
      collapsible: true,
      items: [
        { href: "/master/projects", label: "Proyek", icon: <ProjectIcon size={17} /> },
        { href: "/master/categories", label: "Kategori", icon: <CategoryIcon size={17} /> },
        { href: "/master/pic", label: "PIC", icon: <PicIcon size={17} /> },
        { href: "/master/accounts", label: "Kas & Bank", icon: <BankIcon size={17} /> },
      ],
    },
  ];

  return (
    <>
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 200,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0f172a",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <aside className={`sidebar${mobileOpen ? " open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">PT</div>
          <div>
            <div className="sidebar-brand-text">ProTrack</div>
            <div className="sidebar-brand-sub">Administration & Project Finance</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map((section) => {
            const isCollapsible = !!section.collapsible;
            const isSectionActive = section.items.some((item) => isActive(item.href));

            return (
              <div key={section.label} className="sidebar-group">
                {isCollapsible ? (
                  <button
                    type="button"
                    onClick={() => setMasterExpanded(!masterExpanded)}
                    className="sidebar-section-btn"
                  >
                    <span>{section.label}</span>
                    <span className="sidebar-chevron">
                      {masterExpanded ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
                    </span>
                  </button>
                ) : (
                  <div className="sidebar-section-label">{section.label}</div>
                )}

                {(!isCollapsible || masterExpanded) && (
                  <div className="sidebar-items-list">
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`sidebar-link${active ? " active" : ""}`}
                          onClick={() => setMobileOpen(false)}
                        >
                          <span className="sidebar-link-icon">{item.icon}</span>
                          <span className="sidebar-link-text">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Status Footer */}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">SA</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">Staff Admin</div>
            <div className="sidebar-user-role">
              <span className="user-status-dot" />
              Keuangan Proyek
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
