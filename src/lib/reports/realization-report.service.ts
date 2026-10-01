import { prisma } from "../db/prisma";
import { PaymentMethod, TransactionStatus, DataScope } from "@prisma/client";

export interface RealizationReportFilter {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  picId?: string;
  cashAccountId?: string;
  status?: string;
  dataScope?: string;
}

export interface RealizationReportItem {
  id: string;
  disbursementDate: Date;
  voucherNumber: string;
  noKas: string;
  projectCode: string;
  projectName: string;
  picName: string;
  description: string;
  payerAccountName: string;
  paymentMethod: PaymentMethod;
  realizedAmount: number;
  status: TransactionStatus;
}

export interface RealizationReportResult {
  items: RealizationReportItem[];
  totals: {
    totalRealized: number;
    count: number;
  };
  filterMeta: {
    periodText: string;
    projectText: string;
    picText: string;
    accountText: string;
    statusText: string;
    dataScopeText: string;
  };
}

export async function getRealizationReport(
  filters?: RealizationReportFilter
): Promise<RealizationReportResult> {
  const disbWhere: Record<string, unknown> = {};

  const scope = filters?.dataScope ? (filters.dataScope as DataScope | "ALL") : DataScope.REAL;
  if (scope !== "ALL") {
    disbWhere.dataScope = scope;
  }

  if (filters?.status && filters.status !== "ALL") {
    disbWhere.status = filters.status as TransactionStatus;
  }
  if (filters?.cashAccountId && filters.cashAccountId !== "ALL") {
    disbWhere.cashAccountId = filters.cashAccountId;
  }

  if (filters?.startDate || filters?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) {
      dateFilter.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      dateFilter.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
    disbWhere.disbursementDate = dateFilter;
  }

  const rawDisbItems = await prisma.disbursementItem.findMany({
    where: {
      disbursement: disbWhere,
      accItem: {
        ...(filters?.projectId && filters.projectId !== "ALL"
          ? { projectId: filters.projectId }
          : {}),
        ...(filters?.picId && filters.picId !== "ALL"
          ? { picId: filters.picId }
          : {}),
      },
    },
    orderBy: [
      { disbursement: { disbursementDate: "desc" } },
      { disbursement: { disbursementNumber: "desc" } },
    ],
    include: {
      disbursement: {
        include: { cashAccount: true },
      },
      accItem: {
        include: {
          project: true,
          pic: true,
        },
      },
    },
  });

  const items: RealizationReportItem[] = rawDisbItems.map((item) => ({
    id: item.id,
    disbursementDate: item.disbursement.disbursementDate,
    voucherNumber: item.disbursement.disbursementNumber,
    noKas: item.accItem.noKas,
    projectCode: item.accItem.project.code,
    projectName: item.accItem.project.name,
    picName: item.accItem.pic.name,
    description: item.accItem.description,
    payerAccountName: item.disbursement.cashAccount.accountName,
    paymentMethod: item.disbursement.paymentMethod,
    realizedAmount: Number(item.realizedAmount),
    status: item.disbursement.status,
  }));

  // VOID transactions are excluded from active totals (Financial safety rule)
  const totalRealized = items
    .filter((i) => i.status === TransactionStatus.POSTED)
    .reduce((s, i) => s + i.realizedAmount, 0);

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
      totalRealized,
      count: items.length,
    },
    filterMeta: {
      periodText,
      projectText: filters?.projectId && filters.projectId !== "ALL" ? filters.projectId : "Semua Proyek",
      picText: filters?.picId && filters.picId !== "ALL" ? filters.picId : "Semua PIC",
      accountText: filters?.cashAccountId && filters.cashAccountId !== "ALL" ? filters.cashAccountId : "Semua Akun",
      statusText: filters?.status && filters.status !== "ALL" ? filters.status : "Semua Status",
      dataScopeText: scope === "ALL" ? "Semua Scope (REAL + TEST)" : String(scope),
    },
  };
}
