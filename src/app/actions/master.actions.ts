"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { AccountType, CoaType, NormalBalance } from "@prisma/client";

// ==========================================
// FETCHERS
// ==========================================

export async function getMasterProjectsList() {
  return prisma.project.findMany({
    orderBy: { code: "asc" },
    include: {
      subUnits: { orderBy: { code: "asc" } },
      _count: { select: { accExpenseItems: true } },
    },
  });
}

export async function getMasterCategoriesList() {
  return prisma.expenseCategory.findMany({
    orderBy: { code: "asc" },
    include: {
      subCategories: { orderBy: { code: "asc" } },
      _count: { select: { accExpenseItems: true } },
    },
  });
}

export async function getMasterPicsList() {
  return prisma.fieldPic.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { accExpenseItems: true } },
    },
  });
}

export async function getMasterCashAccountsList() {
  return prisma.cashAccount.findMany({
    orderBy: { accountCode: "asc" },
    include: {
      _count: { select: { fundInflows: true, disbursements: true } },
    },
  });
}

export async function getMasterCoaList() {
  return prisma.coaAccount.findMany({
    orderBy: { accountCode: "asc" },
    include: {
      _count: { select: { journalLines: true } },
    },
  });
}

// ==========================================
// MUTATIONS (Projects & SubUnits)
// ==========================================

export async function createProjectAction(formData: FormData) {
  const code = (formData.get("code") as string).trim().toUpperCase();
  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!code || !name) {
    return { error: "Kode dan Nama Proyek wajib diisi." };
  }

  try {
    await prisma.project.create({
      data: { code, name, description, isActive: true },
    });
    revalidatePath("/master/projects");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah proyek." };
  }
}

export async function createSubUnitAction(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const code = (formData.get("code") as string).trim().toUpperCase();
  const name = (formData.get("name") as string).trim();

  if (!projectId || !code || !name) {
    return { error: "Proyek, Kode, dan Nama Sub-Unit wajib diisi." };
  }

  try {
    await prisma.projectSubUnit.create({
      data: { projectId, code, name, isActive: true },
    });
    revalidatePath("/master/projects");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah sub-unit." };
  }
}

export async function toggleProjectStatusAction(id: string, currentStatus: boolean) {
  try {
    await prisma.project.update({
      where: { id },
      data: { isActive: !currentStatus },
    });
    revalidatePath("/master/projects");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah status proyek." };
  }
}

// ==========================================
// MUTATIONS (Categories)
// ==========================================

export async function createCategoryAction(formData: FormData) {
  const code = (formData.get("code") as string).trim().toUpperCase();
  const name = (formData.get("name") as string).trim();

  if (!code || !name) {
    return { error: "Kode dan Nama Kategori wajib diisi." };
  }

  try {
    await prisma.expenseCategory.create({
      data: { code, name, isActive: true },
    });
    revalidatePath("/master/categories");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah kategori." };
  }
}

export async function createSubCategoryAction(formData: FormData) {
  const categoryId = formData.get("categoryId") as string;
  const code = (formData.get("code") as string).trim().toUpperCase();
  const name = (formData.get("name") as string).trim();

  if (!categoryId || !code || !name) {
    return { error: "Kategori utama, Kode, dan Nama Sub-Kategori wajib diisi." };
  }

  try {
    await prisma.expenseSubCategory.create({
      data: { categoryId, code, name, isActive: true },
    });
    revalidatePath("/master/categories");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah sub-kategori." };
  }
}

export async function toggleCategoryStatusAction(id: string, currentStatus: boolean) {
  try {
    await prisma.expenseCategory.update({
      where: { id },
      data: { isActive: !currentStatus },
    });
    revalidatePath("/master/categories");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah status kategori." };
  }
}

// ==========================================
// MUTATIONS (PIC)
// ==========================================

export async function createPicAction(formData: FormData) {
  const name = (formData.get("name") as string).trim().toUpperCase();
  const roleTitle = (formData.get("roleTitle") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!name) {
    return { error: "Nama PIC wajib diisi." };
  }

  try {
    await prisma.fieldPic.create({
      data: { name, roleTitle, phone, isActive: true },
    });
    revalidatePath("/master/pic");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah PIC." };
  }
}

export async function togglePicStatusAction(id: string, currentStatus: boolean) {
  try {
    await prisma.fieldPic.update({
      where: { id },
      data: { isActive: !currentStatus },
    });
    revalidatePath("/master/pic");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah status PIC." };
  }
}

// ==========================================
// MUTATIONS (Cash & Bank)
// ==========================================

export async function createCashAccountAction(formData: FormData) {
  const accountCode = (formData.get("accountCode") as string).trim().toUpperCase();
  const accountName = (formData.get("accountName") as string).trim();
  const accountType = formData.get("accountType") as AccountType;
  const bankName = (formData.get("bankName") as string)?.trim() || null;
  const accountNumber = (formData.get("accountNumber") as string)?.trim() || null;
  const accountHolder = (formData.get("accountHolder") as string)?.trim() || null;
  const openingBalance = parseFloat(formData.get("openingBalance") as string || "0");

  if (!accountCode || !accountName || !accountType) {
    return { error: "Kode akun, Nama akun, dan Tipe akun wajib diisi." };
  }

  try {
    await prisma.cashAccount.create({
      data: {
        accountCode,
        accountName,
        accountType,
        bankName,
        accountNumber,
        accountHolder,
        openingBalance,
        isActive: true,
      },
    });
    revalidatePath("/master/accounts");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah akun kas/bank." };
  }
}

export async function toggleCashAccountStatusAction(id: string, currentStatus: boolean) {
  try {
    await prisma.cashAccount.update({
      where: { id },
      data: { isActive: !currentStatus },
    });
    revalidatePath("/master/accounts");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah status akun kas/bank." };
  }
}

// ==========================================
// MUTATIONS (COA)
// ==========================================

export async function createCoaAccountAction(formData: FormData) {
  const accountCode = (formData.get("accountCode") as string).trim();
  const accountName = (formData.get("accountName") as string).trim();
  const accountType = formData.get("accountType") as CoaType;
  const normalBalance = formData.get("normalBalance") as NormalBalance;

  if (!accountCode || !accountName || !accountType || !normalBalance) {
    return { error: "Kode akun, Nama akun, Tipe COA, dan Normal balance wajib diisi." };
  }

  try {
    await prisma.coaAccount.create({
      data: {
        accountCode,
        accountName,
        accountType,
        normalBalance,
        isActive: true,
      },
    });
    revalidatePath("/master/coa");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah akun COA." };
  }
}

export async function toggleCoaStatusAction(id: string, currentStatus: boolean) {
  try {
    await prisma.coaAccount.update({
      where: { id },
      data: { isActive: !currentStatus },
    });
    revalidatePath("/master/coa");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah status akun COA." };
  }
}
