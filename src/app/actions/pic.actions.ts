"use server";

import { prisma } from "@/lib/db/prisma";
import { AccStatus, TransactionStatus, DataScope } from "@prisma/client";
import { requireAuth } from "@/lib/auth/auth.service";

export interface PicSummaryItem {
  picId: string;
  picName: string;
  roleTitle?: string | null;
  itemCount: number;
  totalApproved: number;
  totalRealized: number;
  totalOutstanding: number;
}

export interface PicCalculatedItem {
  id: string;
  noKas: string;
  description: string;
  status: AccStatus;
  date: Date;
  picId: string;
  picName: string;
  roleTitle?: string | null;
  assignmentStatus?: string;
  projectCode: string;
  projectName: string;
  categoryName: string;
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
}

export async function getPicDistributionData(searchParams?: {
  picId?: string;
  projectId?: string;
  status?: string;
  dataScope?: string;
  page?: string | number;
  pageSize?: number;
}) {
  await requireAuth();
  const picId = searchParams?.picId;
  const projectId = searchParams?.projectId;
  const status = searchParams?.status;
  const scope = (searchParams?.dataScope as DataScope) || DataScope.REAL;
  const page = searchParams?.page ? Math.max(1, Number(searchParams.page) || 1) : 1;
  const pageSize = searchParams?.pageSize ? Math.max(1, Number(searchParams.pageSize)) : 50;

  // Build filter clause
  const whereClause: Record<string, unknown> = {};
  if (scope !== ("ALL" as unknown as DataScope)) {
    whereClause.dataScope = scope;
  }
  if (picId && picId !== "ALL") {
    whereClause.picId = picId;
  }
  if (projectId && projectId !== "ALL") {
    whereClause.projectId = projectId;
  }
  if (status && status !== "ALL") {
    whereClause.status = status as AccStatus;
  }

  // 1. Fetch PICs, projects, and ACC items in parallel with explicit selects
  const [pics, projects, items] = await Promise.all([
    prisma.fieldPic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, roleTitle: true },
    }),
    prisma.project.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.accExpenseItem.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        noKas: true,
        description: true,
        status: true,
        createdAt: true,
        picId: true,
        approvedAmount: true,
        assignmentStatus: true,
        pic: { select: { id: true, name: true, roleTitle: true } },
        project: { select: { id: true, code: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
        disbursementItems: {
          where: { disbursement: { status: TransactionStatus.POSTED } },
          select: { realizedAmount: true },
        },
      },
    }),
  ]);

  // 2. Calculate per-item realized & outstanding
  const itemsWithCalc: PicCalculatedItem[] = items.map((item) => {
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
      status: item.status,
      date: item.createdAt,
      picId: item.picId,
      picName: item.pic.name,
      roleTitle: item.pic.roleTitle,
      assignmentStatus: item.assignmentStatus,
      projectCode: item.project.code,
      projectName: item.project.name,
      categoryName: item.category.name,
      approvedAmount: approved,
      realizedAmount: realized,
      outstandingAmount: outstanding,
    };
  });

  // 3. Aggregate summary per PIC
  const picSummaries: PicSummaryItem[] = pics
    .map((p) => {
      const picItems = itemsWithCalc.filter((i) => i.picId === p.id);
      const totalApproved = picItems.reduce((s, i) => s + i.approvedAmount, 0);
      const totalRealized = picItems.reduce((s, i) => s + i.realizedAmount, 0);
      const totalOutstanding = picItems.reduce((s, i) => s + i.outstandingAmount, 0);

      return {
        picId: p.id,
        picName: p.name,
        roleTitle: p.roleTitle,
        itemCount: picItems.length,
        totalApproved,
        totalRealized,
        totalOutstanding,
      };
    })
    .filter((p) => p.itemCount > 0 || (picId && picId === p.picId));

  // Overall totals for filtered set
  const totalApproved = itemsWithCalc.reduce((s, i) => s + i.approvedAmount, 0);
  const totalRealized = itemsWithCalc.reduce((s, i) => s + i.realizedAmount, 0);
  const totalOutstanding = itemsWithCalc.reduce((s, i) => s + i.outstandingAmount, 0);

  const totalItems = itemsWithCalc.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedItems = itemsWithCalc.slice((page - 1) * pageSize, page * pageSize);

  return {
    pics,
    projects,
    picSummaries,
    items: paginatedItems,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    totals: {
      totalApproved,
      totalRealized,
      totalOutstanding,
      totalItems,
    },
  };
}
