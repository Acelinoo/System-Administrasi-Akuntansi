"use client";

import { usePathname } from "next/navigation";

const routeTitles: Record<string, { title: string; category: string }> = {
  "/": { title: "Dashboard", category: "OVERVIEW" },
  "/acc": { title: "Data ACC Operasional", category: "TRANSAKSI" },
  "/acc/new": { title: "Input Data ACC Baru", category: "TRANSAKSI" },
  "/acc/import": { title: "Impor Data ACC Excel", category: "TRANSAKSI" },
  "/inflows": { title: "Penerimaan Dana", category: "TRANSAKSI" },
  "/disbursements": { title: "Realisasi Pencairan", category: "TRANSAKSI" },
  "/disbursements/new": { title: "Pencairan Voucher Baru", category: "TRANSAKSI" },
  "/reports/projects": { title: "Monitoring Proyek", category: "MONITORING" },
  "/pic": { title: "Monitoring PIC", category: "MONITORING" },
  "/journals": { title: "Buku Jurnal Akuntansi", category: "KEUANGAN" },
  "/reports": { title: "Laporan & Rekapitulasi", category: "KEUANGAN" },
  "/reports/acc": { title: "Rekapitulasi ACC", category: "KEUANGAN" },
  "/reports/realization": { title: "Realisasi Pencairan", category: "KEUANGAN" },
  "/reports/cash": { title: "Kas & Bank", category: "KEUANGAN" },
  "/reports/pic": { title: "Distribusi PIC", category: "KEUANGAN" },
  "/reports/journals": { title: "Jurnal Akuntansi", category: "KEUANGAN" },
  "/export": { title: "Export Laporan", category: "EXPORT" },
  "/master/projects": { title: "Master Proyek & Sub-Unit", category: "MASTER DATA" },
  "/master/categories": { title: "Master Kategori Biaya", category: "MASTER DATA" },
  "/master/pic": { title: "Master PIC Lapangan", category: "MASTER DATA" },
  "/master/accounts": { title: "Master Kas & Bank", category: "MASTER DATA" },
};

export default function TopHeader() {
  const pathname = usePathname();

  // Find matching title or fallback for dynamic routes like /acc/[id] or /disbursements/[id]
  let current = routeTitles[pathname];
  if (!current) {
    if (pathname.startsWith("/acc/")) {
      current = { title: "Detail Data ACC", category: "TRANSAKSI" };
    } else if (pathname.startsWith("/disbursements/")) {
      current = { title: "Detail Pencairan Voucher", category: "TRANSAKSI" };
    } else {
      current = { title: "Administrasi & Keuangan", category: "PROTRACK" };
    }
  }

  return (
    <header className="top-header">
      <div className="top-header-left">
        <span className="top-header-category">{current.category}</span>
        <span className="top-header-divider">/</span>
        <span className="top-header-title">{current.title}</span>
      </div>

      <div className="top-header-right">
        <div className="top-header-badge">
          <span className="status-indicator-dot online" />
          <span>REAL DATA</span>
        </div>

        <div className="top-header-divider-v" />

        <div className="top-header-user">
          <div className="top-header-avatar">SA</div>
          <div className="top-header-user-meta">
            <span className="user-name">Staff Administrasi</span>
            <span className="user-role">Finance & Projects</span>
          </div>
        </div>
      </div>
    </header>
  );
}
