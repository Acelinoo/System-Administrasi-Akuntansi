"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getAuthStatusAction, logoutAction } from "@/app/actions/auth.actions";

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
  "/master/vendors": { title: "Master Vendor & Rekanan", category: "MASTER DATA" },
  "/master/categories": { title: "Master Kategori Biaya", category: "MASTER DATA" },
  "/master/pic": { title: "Master PIC Lapangan", category: "MASTER DATA" },
  "/master/accounts": { title: "Master Kas & Bank", category: "MASTER DATA" },
  "/master/users": { title: "Manajemen Pengguna & Akses", category: "MASTER DATA" },
};

export default function TopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isTest = searchParams?.get("scope") === "TEST";

  const [userInfo, setUserInfo] = useState<{
    username: string;
    fullName: string;
    role: "ADMIN" | "STAFF";
  } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    getAuthStatusAction().then((status) => {
      if (mounted && status.isAuthenticated && status.user) {
        setUserInfo(status.user);
      }
    });
    return () => {
      mounted = false;
    };
  }, [pathname]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logoutAction();
    router.push("/login");
  };

  // Find matching title or fallback for dynamic routes like /acc/[id] or /disbursements/[id]
  let current = routeTitles[pathname];
  if (!current) {
    if (pathname.startsWith("/acc/")) {
      current = { title: "Detail Data ACC", category: "TRANSAKSI" };
    } else if (pathname.startsWith("/disbursements/")) {
      current = { title: "Detail Pencairan Voucher", category: "TRANSAKSI" };
    } else if (pathname.startsWith("/projects/")) {
      current = { title: "Detail Proyek 360", category: "MONITORING" };
    } else {
      current = { title: "Administrasi & Keuangan", category: "PROTRACK" };
    }
  }

  const initials = userInfo?.fullName
    ? userInfo.fullName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : userInfo?.username
    ? userInfo.username.slice(0, 2).toUpperCase()
    : "PT";

  return (
    <header className="top-header">
      <div className="top-header-left">
        <span className="top-header-category">{current.category}</span>
        <span className="top-header-divider">/</span>
        <span className="top-header-title">{current.title}</span>
      </div>

      <div className="top-header-right">
        {isTest ? (
          <div className="top-header-badge test-mode" title="Sedang aktif pada ruang lingkup pengujian UAT (scope=TEST)">
            <span className="status-indicator-dot test" />
            <span>TEST DATA (UAT)</span>
            <Link
              href={pathname}
              className="top-header-scope-toggle"
              title="Beralih ke tampilan Data Operasional Nyata (REAL)"
            >
              (Beralih ke REAL)
            </Link>
          </div>
        ) : (
          <div className="top-header-badge" title="Sedang aktif pada ruang lingkup data operasional resmi (scope=REAL)">
            <span className="status-indicator-dot online" />
            <span>REAL DATA</span>
            <Link
              href={`${pathname}?scope=TEST`}
              className="top-header-scope-toggle"
              title="Beralih ke tampilan Lingkungan Uji Coba (TEST UAT)"
            >
              (Mode UAT)
            </Link>
          </div>
        )}

        <div className="top-header-divider-v" />

        <div className="top-header-user">
          <div
            className="top-header-avatar"
            style={{
              background: userInfo?.role === "ADMIN" ? "#1e293b" : "var(--blue-600)",
              color: "#ffffff",
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
          <div className="top-header-user-meta">
            <span className="user-name">
              {userInfo?.fullName || (userInfo?.username ? `@${userInfo.username}` : "Memuat...")}
            </span>
            <span
              className="user-role"
              style={{
                color: userInfo?.role === "ADMIN" ? "#b45309" : "#2563eb",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            >
              {userInfo?.role === "ADMIN" ? "ADMIN (Pimpinan)" : "STAFF (Operasional)"}
            </span>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Keluar dari akun"
            style={{
              marginLeft: "8px",
              padding: "4px 8px",
              fontSize: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#64748b",
              cursor: loggingOut ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "#dc2626";
              e.currentTarget.style.borderColor = "#fca5a5";
              e.currentTarget.style.background = "#fef2f2";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "#64748b";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.background = "#ffffff";
            }}
          >
            {loggingOut ? "..." : "Keluar"}
          </button>
        </div>
      </div>
    </header>
  );
}
