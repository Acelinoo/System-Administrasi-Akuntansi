import { getAdminCount } from "@/lib/auth/auth.service";
import SetupAdminForm from "./SetupAdminForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SetupAdminPage() {
  const adminCount = await getAdminCount();
  if (adminCount > 0) {
    redirect("/login");
  }

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
      <SetupAdminForm />
    </div>
  );
}
