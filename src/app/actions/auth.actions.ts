"use server";

import { authenticateUser, logoutUser, setupInitialAdmin, getCurrentUser, getAdminCount } from "@/lib/auth/auth.service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  let clientIp = "local";
  try {
    const headerStore = await headers();
    clientIp =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      "local";
  } catch {
    // Graceful fallback outside request store context
  }

  const result = await authenticateUser(username, password, clientIp);
  if (!result.success) {
    return { error: result.error || "Login gagal." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function logoutAction() {
  await logoutUser();
  revalidatePath("/");
  redirect("/login");
}

export async function setupAdminAction(formData: FormData) {
  const username = formData.get("username") as string;
  const fullName = formData.get("fullName") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return { error: "Konfirmasi password tidak cocok." };
  }

  const result = await setupInitialAdmin({ username, fullName, password });
  if (!result.success) {
    return { error: result.error || "Gagal membuat akun Administrator." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function getAuthStatusAction() {
  const user = await getCurrentUser();
  const adminCount = await getAdminCount();
  return {
    isAuthenticated: !!user,
    user,
    hasAdmin: adminCount > 0,
  };
}
