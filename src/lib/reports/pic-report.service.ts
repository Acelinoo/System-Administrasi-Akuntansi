import { prisma } from "../db/prisma";
import { AccStatus, TransactionStatus, DataScope } from "@prisma/client";

export interface PicDetailTransaction {
  id: string;
  noKas: string;
  accDate: Date;
  projectCode: string;
  categoryName: string;
  description: string;
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  status: AccStatus;
  assignmentStatus?: string;
}

export interface PicReportGroup {
  picId: string;
  picName: string;
  roleTitle: string | null;
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  itemCount: number;
  items: PicDetailTransaction[];
}

export interface PicReportResult {
  pics: PicReportGroup[];
  totals: {
    totalApproved: number;
    totalRealized: number;
    totalOutstanding: number;
    picCount: number;
  };
  filterMeta: {
    periodText: string;
    picText: string;
    projectText: string;
    statusText: string;
    dataScopeText: string;
  };
}

export async function getPicReport(filters?: {
  startDate?: string;
  endDate?: string;
  picId?: string;
  projectId?: string;
  status?: string;
  dataScope?: string;
}): Promise<PicReportResult> {
  const where: Record<string, unknown> = {};

  const scope = filters?.dataScope ? (filters.dataScope as DataScope | "ALL") : DataScope.REAL;
  if (scope !== "ALL") {
    where.dataScope = scope;
  }

  if (filters?.picId && filters.picId !== "ALL") {
    where.picId = filters.picId;
  }
  if (filters?.projectId && filters.projectId !== "ALL") {
    where.projectId = filters.projectId;
  }
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status as AccStatus;
  }

  if (filters?.startDate || filters?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) {
      dateFilter.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      dateFilter.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
    where.batch = { accDate: dateFilter };
  }

  const picList = await prisma.fieldPic.findMany({
    where: filters?.picId && filters.picId !== "ALL" ? { id: filters.picId } : { isActive: true },
    orderBy: { name: "asc" },
  });

  const rawItems = await prisma.accExpenseItem.findMany({
    where,
    orderBy: [{ batch: { accDate: "desc" } }, { noKas: "asc" }],
    include: {
      batch: { select: { accDate: true } },
      project: { select: { code: true } },
      category: { select: { name: true } },
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
        select: { realizedAmount: true },
      },
    },
  });

  const pics: PicReportGroup[] = picList.map((pic) => {
    const picItems = rawItems.filter((i) => i.picId === pic.id);

    const items: PicDetailTransaction[] = picItems.map((item) => {
      const approved = Number(item.approvedAmount);
      const realized = item.disbursementItems.reduce(
        (s, d) => s + Number(d.realizedAmount),
        0
      );
      const outstanding = Math.max(0, approved - realized);

      return {
        id: item.id,
        noKas: item.noKas,
        accDate: item.batch.accDate,
        projectCode: item.project.code,
        categoryName: item.category.name,
        description: item.description,
        approvedAmount: approved,
        realizedAmount: realized,
        outstandingAmount: outstanding,
        status: item.status,
        assignmentStatus: item.assignmentStatus,
      };
    });

    const approvedAmount = items.reduce((s, i) => s + i.approvedAmount, 0);
    const realizedAmount = items.reduce((s, i) => s + i.realizedAmount, 0);
    const outstandingAmount = items.reduce((s, i) => s + i.outstandingAmount, 0);

    return {
      picId: pic.id,
      picName: pic.name,
      roleTitle: pic.roleTitle,
      approvedAmount,
      realizedAmount,
      outstandingAmount,
      itemCount: items.length,
      items,
    };
  }).filter((p) => p.itemCount > 0 || (filters?.picId && filters.picId === p.picId));

  const totalApproved = pics.reduce((s, p) => s + p.approvedAmount, 0);
  const totalRealized = pics.reduce((s, p) => s + p.realizedAmount, 0);
  const totalOutstanding = pics.reduce((s, p) => s + p.outstandingAmount, 0);

  let periodText = "Semua Periode";
  if (filters?.startDate && filters?.endDate) {
    periodText = `${filters.startDate} s.d. ${filters.endDate}`;
  } else if (filters?.startDate) {
    periodText = `Mulai ${filters.startDate}`;
  } else if (filters?.endDate) {
    periodText = `Sampai ${filters.endDate}`;
  }

  return {
    pics,
    totals: {
      totalApproved,
      totalRealized,
      totalOutstanding,
      picCount: pics.length,
    },
    filterMeta: {
      periodText,
      picText: filters?.picId && filters.picId !== "ALL" ? filters.picId : "Semua PIC",
      projectText: filters?.projectId && filters.projectId !== "ALL" ? filters.projectId : "Semua Proyek",
      statusText: filters?.status && filters.status !== "ALL" ? filters.status : "Semua Status",
      dataScopeText: scope === "ALL" ? "Semua Scope (REAL + TEST)" : String(scope),
    },
  };
}
