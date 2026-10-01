"use server";

import { prisma } from "@/lib/db/prisma";
import { AccStatus, TransactionStatus, DataScope } from "@prisma/client";

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
}) {
  const picId = searchParams?.picId;
  const projectId = searchParams?.projectId;
  const status = searchParams?.status;
  const scope = (searchParams?.dataScope as DataScope) || DataScope.REAL;

  // 1. Fetch all PICs
  const pics = await prisma.fieldPic.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // 2. Fetch projects for filter
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  // 3. Fetch ACC items with filters
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

  const items = await prisma.accExpenseItem.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      pic: { select: { id: true, name: true, roleTitle: true } },
      project: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, code: true, name: true } },
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
        select: { realizedAmount: true },
      },
    },
  });

  // 4. Calculate per-item realized & outstanding
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

  // 5. Aggregate summary per PIC
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

  return {
    pics,
    projects,
    picSummaries,
    items: itemsWithCalc,
    totals: {
      totalApproved,
      totalRealized,
      totalOutstanding,
      totalItems: itemsWithCalc.length,
    },
  };
}
