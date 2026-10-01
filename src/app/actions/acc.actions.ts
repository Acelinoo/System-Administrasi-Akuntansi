"use server";

import { prisma } from "@/lib/db/prisma";
import { createSubmissionBatch } from "@/lib/finance/acc.service";
import { AccStatus, TransactionStatus, DataScope } from "@prisma/client";
import { revalidatePath } from "next/cache";

// -------------------------------------------------------
// DATA FETCHING (read-only queries)
// -------------------------------------------------------

export async function getDashboardStats(dataScope: DataScope | "ALL" = DataScope.REAL) {
  const scopeFilter = dataScope === "ALL" ? {} : { dataScope };

  const [
    totalBatches,
    totalAccItems,
    approvedItems,
    partialItems,
    realizedItems,
    cancelledItems,
    accApprovedAgg,
    postedInflows,
    postedDisbursements,
    recentAccRaw,
    recentDisbursementsRaw,
    activeAccForTopOutstanding,
  ] = await Promise.all([
    prisma.submissionBatch.count({ where: scopeFilter }),
    prisma.accExpenseItem.count({ where: scopeFilter }),
    prisma.accExpenseItem.count({ where: { ...scopeFilter, status: AccStatus.APPROVED } }),
    prisma.accExpenseItem.count({ where: { ...scopeFilter, status: AccStatus.PARTIALLY_REALIZED } }),
    prisma.accExpenseItem.count({ where: { ...scopeFilter, status: AccStatus.FULLY_REALIZED } }),
    prisma.accExpenseItem.count({ where: { ...scopeFilter, status: AccStatus.CANCELLED } }),
    prisma.accExpenseItem.aggregate({
      where: scopeFilter,
      _sum: { approvedAmount: true },
    }),
    prisma.fundInflow.aggregate({
      where: { ...scopeFilter, status: TransactionStatus.POSTED },
      _sum: { amount: true },
    }),
    prisma.disbursement.aggregate({
      where: { ...scopeFilter, status: TransactionStatus.POSTED },
      _sum: { totalRealizedAmount: true },
    }),
    prisma.accExpenseItem.findMany({
      where: scopeFilter,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        batch: { select: { accDate: true, batchCode: true, administrativeSubmitter: true } },
        project: { select: { code: true, name: true } },
        pic: { select: { name: true } },
        disbursementItems: {
          where: { disbursement: { status: TransactionStatus.POSTED } },
          select: { realizedAmount: true },
        },
      },
    }),
    prisma.disbursement.findMany({
      where: scopeFilter,
      take: 5,
      orderBy: [{ disbursementDate: "desc" }, { createdAt: "desc" }],
      include: {
        cashAccount: { select: { accountName: true, accountCode: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.accExpenseItem.findMany({
      where: { ...scopeFilter, status: { in: [AccStatus.APPROVED, AccStatus.PARTIALLY_REALIZED] } },
      orderBy: { approvedAmount: "desc" },
      take: 20,
      include: {
        project: { select: { code: true, name: true } },
        pic: { select: { name: true } },
        disbursementItems: {
          where: { disbursement: { status: TransactionStatus.POSTED } },
          select: { realizedAmount: true },
        },
      },
    }),
  ]);

  const totalAccAmount = Number(accApprovedAgg._sum.approvedAmount ?? 0);
  const totalInflow = Number(postedInflows._sum.amount ?? 0);
  const totalDisbursement = Number(postedDisbursements._sum.totalRealizedAmount ?? 0);
  const totalRealizedAmount = totalDisbursement;
  const totalOutstandingAmount = Math.max(0, totalAccAmount - totalRealizedAmount);

  const recentAccItems = recentAccRaw.map((item) => {
    const approved = Number(item.approvedAmount);
    const realized = item.disbursementItems.reduce(
      (sum, d) => sum + Number(d.realizedAmount),
      0
    );
    return {
      id: item.id,
      noKas: item.noKas,
      description: item.description,
      accDate: item.batch.accDate,
      projectCode: item.project.code,
      picName: item.pic.name,
      approvedAmount: approved,
      realizedAmount: realized,
      outstandingAmount: Math.max(0, approved - realized),
      status: item.status,
      assignmentStatus: item.assignmentStatus,
      administrativeSubmitter: item.batch.administrativeSubmitter,
    };
  });

  const recentDisbursements = recentDisbursementsRaw.map((d) => ({
    id: d.id,
    disbursementNumber: d.disbursementNumber,
    disbursementDate: d.disbursementDate,
    accountName: d.cashAccount.accountName,
    accountCode: d.cashAccount.accountCode,
    paymentMethod: d.paymentMethod,
    totalRealizedAmount: Number(d.totalRealizedAmount),
    itemCount: d._count.items,
    status: d.status,
  }));

  const topOutstandingItems = activeAccForTopOutstanding
    .map((item) => {
      const approved = Number(item.approvedAmount);
      const realized = item.disbursementItems.reduce(
        (sum, d) => sum + Number(d.realizedAmount),
        0
      );
      const outstanding = Math.max(0, approved - realized);
      return {
        id: item.id,
        noKas: item.noKas,
        description: item.description,
        projectCode: item.project.code,
        picName: item.pic.name,
        approvedAmount: approved,
        realizedAmount: realized,
        outstandingAmount: outstanding,
        status: item.status,
      };
    })
    .filter((i) => i.outstandingAmount > 0)
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
    .slice(0, 5);

  return {
    dataScope: String(dataScope),
    totalBatches,
    totalAccItems,
    approvedItems,
    partialItems,
    realizedItems,
    cancelledItems,
    totalAccAmount,
    totalRealizedAmount,
    totalOutstandingAmount,
    totalInflow,
    totalDisbursement,
    recentAccItems,
    recentDisbursements,
    topOutstandingItems,
  };
}

export async function getAccBatchList(dataScope: DataScope | "ALL" = DataScope.REAL) {
  const where = dataScope === "ALL" ? {} : { dataScope };
  return prisma.submissionBatch.findMany({
    where,
    orderBy: { accDate: "desc" },
    include: {
      _count: { select: { items: true } },
      items: {
        select: {
          approvedAmount: true,
          status: true,
        },
      },
    },
  });
}

export async function getAccItemList(filters?: {
  status?: AccStatus;
  projectId?: string;
  search?: string;
  dataScope?: DataScope | "ALL";
}) {
  const targetScope = filters?.dataScope ?? DataScope.REAL;
  const where: Record<string, unknown> = targetScope === "ALL" ? {} : { dataScope: targetScope };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.projectId) {
    where.projectId = filters.projectId;
  }
  if (filters?.search) {
    where.OR = [
      { noKas: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.accExpenseItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      batch: { select: { batchCode: true, accDate: true, administrativeSubmitter: true } },
      project: { select: { code: true, name: true } },
      subUnit: { select: { code: true, name: true } },
      category: { select: { code: true, name: true } },
      subCategory: { select: { code: true, name: true } },
      pic: { select: { name: true, roleTitle: true } },
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
        select: { realizedAmount: true },
      },
    },
  });
}

export async function getAccItemDetail(id: string) {
  return prisma.accExpenseItem.findUnique({
    where: { id },
    include: {
      batch: true,
      project: true,
      subUnit: true,
      category: true,
      subCategory: true,
      pic: true,
      disbursementItems: {
        include: {
          disbursement: {
            select: {
              disbursementNumber: true,
              disbursementDate: true,
              paymentMethod: true,
              status: true,
              cashAccount: { select: { accountName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// -------------------------------------------------------
// MASTER DATA LOOKUPS (for form dropdowns)
// -------------------------------------------------------

export async function getMasterProjects() {
  return prisma.project.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      subUnits: {
        where: { isActive: true },
        orderBy: { code: "asc" },
      },
    },
  });
}

export async function getMasterCategories() {
  return prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      subCategories: {
        where: { isActive: true },
        orderBy: { code: "asc" },
      },
    },
  });
}

export async function getMasterPics() {
  return prisma.fieldPic.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getMasterCashAccounts() {
  return prisma.cashAccount.findMany({
    where: { isActive: true },
    orderBy: { accountCode: "asc" },
  });
}

// -------------------------------------------------------
// MUTATIONS (server actions that call service layer)
// -------------------------------------------------------

export async function createAccBatchAction(formData: FormData) {
  const batchCode = formData.get("batchCode") as string;
  const accDate = formData.get("accDate") as string;
  const approvedByName = (formData.get("approvedByName") as string) || "Pa Giri";
  const notes = formData.get("notes") as string | null;

  // Parse items from JSON (sent as hidden field)
  const itemsJson = formData.get("items") as string;
  let items;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Format data item tidak valid." };
  }

  try {
    const result = await createSubmissionBatch({
      batchCode,
      accDate: new Date(accDate),
      approvedByName,
      notes: notes || null,
      items,
    });

    revalidatePath("/acc");
    revalidatePath("/");
    return { success: true, batchId: result.batch.id, itemCount: result.items.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data.";
    return { error: message };
  }
}
