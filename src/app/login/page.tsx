import { getAdminCount } from "@/lib/auth/auth.service";
import LoginForm from "./LoginForm";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const adminCount = await getAdminCount();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: "var(--space-4)",
      }}
    >
      <Suspense fallback={<div>Memuat...</div>}>
        <LoginForm hasAdmin={adminCount > 0} />
      </Suspense>
    </div>
  );
}
