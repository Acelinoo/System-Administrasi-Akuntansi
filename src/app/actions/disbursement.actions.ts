"use server";

import { prisma } from "@/lib/db/prisma";
import { createDisbursement, voidDisbursement } from "@/lib/finance/disbursement.service";
import { getAllCashBalances } from "@/lib/finance/balance.service";
import { AccStatus, TransactionStatus, DataScope } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getDisbursementList(dataScope: DataScope | "ALL" = DataScope.REAL) {
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
  return getAllCashBalances(undefined, dataScope);
}

export async function createDisbursementAction(formData: FormData) {
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

  try {
    const result = await createDisbursement({
      disbursementDate: new Date(disbursementDate),
      cashAccountId,
      paymentMethod: paymentMethod as "CASH" | "TRANSFER" | "GIRO",
      totalRealizedAmount,
      notes: notes || null,
      items,
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
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    return { error: message };
  }
}

export async function voidDisbursementAction(formData: FormData) {
  const disbursementId = formData.get("disbursementId") as string;
  const voidReason = formData.get("voidReason") as string;

  try {
    await voidDisbursement(disbursementId, voidReason);
    revalidatePath("/disbursements");
    revalidatePath("/acc");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    return { error: message };
  }
}
