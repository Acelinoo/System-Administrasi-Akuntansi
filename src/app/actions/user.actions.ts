"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/auth.service";
import { hashPassword } from "@/lib/auth/password";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getUsersListAction() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          submissionBatches: true,
          fundInflows: true,
          disbursements: true,
        },
      },
    },
  });
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const fullName = (formData.get("fullName") as string)?.trim();
  const password = formData.get("password") as string;
  const roleRaw = formData.get("role") as string;
  const role = roleRaw === "ADMIN" ? UserRole.ADMIN : UserRole.STAFF;

  if (!username || username.length < 3) {
    return { error: "Username wajib diisi minimal 3 karakter." };
  }
  if (!fullName || fullName.length < 3) {
    return { error: "Nama lengkap wajib diisi minimal 3 karakter." };
  }
  if (!password || password.length < 8) {
    return { error: "Password wajib diisi minimal 8 karakter." };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { error: "Username sudah digunakan oleh akun lain." };
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: {
        username,
        fullName,
        passwordHash,
        role,
        isActive: true,
      },
    });

    revalidatePath("/master/users");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal membuat pengguna." };
  }
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireAdmin();

  const userId = formData.get("userId") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const roleRaw = formData.get("role") as string;
  const isActive = formData.get("isActive") === "true";
  const role = roleRaw === "ADMIN" ? UserRole.ADMIN : UserRole.STAFF;

  if (!userId || !fullName) {
    return { error: "ID dan Nama Lengkap wajib diisi." };
  }

  // Prevent self-demotion or self-deactivation
  if (admin.id === userId && (role !== UserRole.ADMIN || !isActive)) {
    return { error: "Anda tidak dapat menurunkan peran atau menonaktifkan akun Anda sendiri." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        role,
        isActive,
      },
    });

    revalidatePath("/master/users");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal memperbarui pengguna." };
  }
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();

  const userId = formData.get("userId") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!userId || !newPassword || newPassword.length < 8) {
    return { error: "Password baru wajib diisi minimal 8 karakter." };
  }

  const passwordHash = await hashPassword(newPassword);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    revalidatePath("/master/users");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mereset password." };
  }
}

export async function toggleUserActiveAction(userId: string) {
  const admin = await requireAdmin();

  if (admin.id === userId) {
    return { error: "Anda tidak dapat menonaktifkan akun Anda sendiri." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return { error: "Pengguna tidak ditemukan." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: !target.isActive },
    });

    revalidatePath("/master/users");
    return { success: true, isActive: !target.isActive };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah status aktif pengguna." };
  }
}
