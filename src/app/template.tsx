"use client";

import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/setup-admin";

  if (isAuthPage) {
    return <main className="auth-clean-wrapper">{children}</main>;
  }

  return (
    <div className="app-layout">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="app-main-wrapper">
        <Suspense fallback={null}>
          <TopHeader />
        </Suspense>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
