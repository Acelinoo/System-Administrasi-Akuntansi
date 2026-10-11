"use server";

import { prisma } from "@/lib/db/prisma";
import { createDisbursement, voidDisbursement } from "@/lib/finance/disbursement.service";
import { getAllCashBalances } from "@/lib/finance/balance.service";
import { requireAuth, requireAdmin } from "@/lib/auth/auth.service";
import { AccStatus, TransactionStatus, DataScope } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sanitizeErrorMessage } from "@/lib/utils/error";

export async function getDisbursementPageSummary(dataScope: DataScope | "ALL" = DataScope.REAL) {
  await requireAuth();
  const scopeFilter = dataScope === "ALL" ? {} : { dataScope };
  const [accAgg, postedDisbursementsAgg, totalAccItems] = await Promise.all([
    prisma.accExpenseItem.aggregate({
      where: scopeFilter,
      _sum: { approvedAmount: true },
    }),
    prisma.disbursement.aggregate({
      where: { ...scopeFilter, status: TransactionStatus.POSTED },
      _sum: { totalRealizedAmount: true },
    }),
    prisma.accExpenseItem.count({ where: scopeFilter }),
  ]);

  const totalAccAmount = Number(accAgg._sum.approvedAmount ?? 0);
  const totalRealizedAmount = Number(postedDisbursementsAgg._sum.totalRealizedAmount ?? 0);
  const totalOutstandingAmount = Math.max(0, totalAccAmount - totalRealizedAmount);

  return {
    totalAccAmount,
    totalRealizedAmount,
    totalOutstandingAmount,
    totalAccItems,
  };
}

export async function getDisbursementList(dataScope: DataScope | "ALL" = DataScope.REAL) {
  await requireAuth();
  const where = dataScope === "ALL" ? {} : { dataScope };
  return prisma.disbursement.findMany({
    where,
    orderBy: { disbursementDate: "desc" },
    include: {
      cashAccount: {
        select: { accountCode: true, accountName: true },
      },
      _count: { select: { items: true } },
    },
  });
}

export async function getDisbursementDetail(id: string) {
  await requireAuth();
  return prisma.disbursement.findUnique({
    where: { id },
    include: {
      cashAccount: true,
      items: {
        include: {
          accItem: {
            select: {
              noKas: true,
              description: true,
              approvedAmount: true,
              project: { select: { code: true, name: true } },
              pic: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

export async function getOutstandingAccItems(dataScope: DataScope | "ALL" = DataScope.REAL) {
  await requireAuth();
  const scopeFilter = dataScope === "ALL" ? {} : { dataScope };
  return prisma.accExpenseItem.findMany({
    where: {
      ...scopeFilter,
      status: {
        in: [AccStatus.APPROVED, AccStatus.PARTIALLY_REALIZED],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { code: true, name: true } },
      pic: { select: { name: true } },
      category: { select: { code: true, name: true } },
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
        select: { realizedAmount: true },
      },
    },
  });
}

export async function getCashBalances(dataScope: DataScope | "ALL" = DataScope.REAL) {
  await requireAuth();
  return getAllCashBalances(undefined, dataScope);
}

export async function createDisbursementAction(formData: FormData) {
  const user = await requireAuth();

  const disbursementDate = formData.get("disbursementDate") as string;
  const cashAccountId = formData.get("cashAccountId") as string;
  const paymentMethod = formData.get("paymentMethod") as string;
  const totalRealizedAmount = parseFloat(formData.get("totalRealizedAmount") as string);
  const notes = formData.get("notes") as string | null;

  const itemsJson = formData.get("items") as string;
  let items;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Format data item pencairan tidak valid." };
  }

  const dataScopeRaw = formData.get("dataScope") as string | null;
  const dataScope = dataScopeRaw === "TEST" ? DataScope.TEST : dataScopeRaw === "REAL" ? DataScope.REAL : undefined;

  try {
    const result = await createDisbursement({
      disbursementDate: new Date(disbursementDate),
      cashAccountId,
      paymentMethod: paymentMethod as "CASH" | "TRANSFER" | "GIRO",
      totalRealizedAmount,
      notes: notes || null,
      items,
      createdById: user.id,
      dataScope,
    });

    revalidatePath("/disbursements");
    revalidatePath("/acc");
    revalidatePath("/");
    return {
      success: true,
      disbursementId: result.disbursement.id,
      total: result.calculatedTotal,
    };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { error: err.errors.map((e) => e.message).join(", ") };
    }
    return { error: sanitizeErrorMessage(err, "Terjadi kesalahan saat memproses pencairan.") };
  }
}

export async function voidDisbursementAction(formData: FormData) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    return { error: sanitizeErrorMessage(err, "Akses ditolak: Operasi ini memerlukan hak Administrator.") };
  }

  const disbursementId = formData.get("disbursementId") as string;
  const voidReason = formData.get("voidReason") as string;
  const dataScopeRaw = formData.get("dataScope") as string | null;
  const expectedScope = dataScopeRaw === "TEST" ? DataScope.TEST : dataScopeRaw === "REAL" ? DataScope.REAL : undefined;

  try {
    await voidDisbursement(disbursementId, voidReason, undefined, expectedScope);
    revalidatePath("/disbursements");
    revalidatePath("/acc");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    return { error: sanitizeErrorMessage(err, "Terjadi kesalahan saat membatalkan pencairan.") };
  }
}
