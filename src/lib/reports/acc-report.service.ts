import { prisma } from "../db/prisma";
import { AccStatus, TransactionStatus, DataScope } from "@prisma/client";

export interface AccReportFilter {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  subUnitId?: string;
  categoryId?: string;
  picId?: string;
  status?: string;
  dataScope?: string;
}

export interface AccReportItem {
  id: string;
  noKas: string;
  accDate: Date;
  batchCode: string;
  projectCode: string;
  projectName: string;
  subUnitCode: string | null;
  categoryCode: string;
  categoryName: string;
  picName: string;
  description: string;
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  status: AccStatus;
  assignmentStatus?: string;
  administrativeSubmitter?: string;
}

export interface AccReportResult {
  items: AccReportItem[];
  totals: {
    totalApproved: number;
    totalRealized: number;
    totalOutstanding: number;
    count: number;
  };
  filterMeta: {
    periodText: string;
    projectText: string;
    categoryText: string;
    picText: string;
    statusText: string;
    dataScopeText: string;
  };
}

export async function getAccReport(filters?: AccReportFilter): Promise<AccReportResult> {
  const where: Record<string, unknown> = {};

  const scope = filters?.dataScope ? (filters.dataScope as DataScope | "ALL") : DataScope.REAL;
  if (scope !== "ALL") {
    where.dataScope = scope;
  }

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status as AccStatus;
  }
  if (filters?.projectId && filters.projectId !== "ALL") {
    where.projectId = filters.projectId;
  }
  if (filters?.subUnitId && filters.subUnitId !== "ALL") {
    where.subUnitId = filters.subUnitId;
  }
  if (filters?.categoryId && filters.categoryId !== "ALL") {
    where.categoryId = filters.categoryId;
  }
  if (filters?.picId && filters.picId !== "ALL") {
    where.picId = filters.picId;
  }

  // Period filter on batch accDate
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

  const rawItems = await prisma.accExpenseItem.findMany({
    where,
    orderBy: [{ batch: { accDate: "desc" } }, { noKas: "asc" }],
    include: {
      batch: { select: { batchCode: true, accDate: true, administrativeSubmitter: true } },
      project: { select: { code: true, name: true } },
      subUnit: { select: { code: true, name: true } },
      category: { select: { code: true, name: true } },
      pic: { select: { name: true, roleTitle: true } },
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
        select: { realizedAmount: true },
      },
    },
  });

  const items: AccReportItem[] = rawItems.map((item) => {
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
      batchCode: item.batch.batchCode,
      projectCode: item.project.code,
      projectName: item.project.name,
      subUnitCode: item.subUnit?.code || null,
      categoryCode: item.category.code,
      categoryName: item.category.name,
      picName: item.pic.name,
      description: item.description,
      approvedAmount: approved,
      realizedAmount: realized,
      outstandingAmount: outstanding,
      status: item.status,
      assignmentStatus: item.assignmentStatus,
      administrativeSubmitter: item.batch.administrativeSubmitter,
    };
  });

  const totalApproved = items.reduce((s, i) => s + i.approvedAmount, 0);
  const totalRealized = items.reduce((s, i) => s + i.realizedAmount, 0);
  const totalOutstanding = items.reduce((s, i) => s + i.outstandingAmount, 0);

  // Metadata labels for export header
  let periodText = "Semua Periode";
  if (filters?.startDate && filters?.endDate) {
    periodText = `${filters.startDate} s.d. ${filters.endDate}`;
  } else if (filters?.startDate) {
    periodText = `Mulai ${filters.startDate}`;
  } else if (filters?.endDate) {
    periodText = `Sampai ${filters.endDate}`;
  }

  return {
    items,
    totals: {
      totalApproved,
      totalRealized,
      totalOutstanding,
      count: items.length,
    },
    filterMeta: {
      periodText,
      projectText: filters?.projectId && filters.projectId !== "ALL" ? filters.projectId : "Semua Proyek",
      categoryText: filters?.categoryId && filters.categoryId !== "ALL" ? filters.categoryId : "Semua Kategori",
      picText: filters?.picId && filters.picId !== "ALL" ? filters.picId : "Semua PIC",
      statusText: filters?.status && filters.status !== "ALL" ? filters.status : "Semua Status",
      dataScopeText: scope === "ALL" ? "Semua Scope (REAL + TEST)" : String(scope),
    },
  };
}
