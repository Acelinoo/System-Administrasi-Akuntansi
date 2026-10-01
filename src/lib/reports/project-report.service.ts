import { prisma } from "../db/prisma";
import { TransactionStatus, DataScope } from "@prisma/client";

export interface ProjectCategoryBreakdown {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  itemCount: number;
}

export interface ProjectReportSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  confirmationStatus?: string;
  possibleParentCode?: string | null;
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  itemCount: number;
  categories: ProjectCategoryBreakdown[];
}

export interface ProjectReportResult {
  projects: ProjectReportSummary[];
  totals: {
    totalApproved: number;
    totalRealized: number;
    totalOutstanding: number;
    projectCount: number;
  };
  filterMeta: {
    periodText: string;
    projectText: string;
    dataScopeText: string;
  };
}

export async function getProjectReport(filters?: {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  dataScope?: string;
}): Promise<ProjectReportResult> {
  const where: Record<string, unknown> = {};

  const scope = filters?.dataScope ? (filters.dataScope as DataScope | "ALL") : DataScope.REAL;
  if (scope !== "ALL") {
    where.dataScope = scope;
  }

  if (filters?.projectId && filters.projectId !== "ALL") {
    where.projectId = filters.projectId;
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

  // Fetch all projects or selected project
  const projectList = await prisma.project.findMany({
    where: filters?.projectId && filters.projectId !== "ALL" ? { id: filters.projectId } : {},
    orderBy: { code: "asc" },
  });

  // Fetch items
  const items = await prisma.accExpenseItem.findMany({
    where,
    include: {
      category: true,
      disbursementItems: {
        where: { disbursement: { status: TransactionStatus.POSTED } },
        select: { realizedAmount: true },
      },
    },
  });

  const projects: ProjectReportSummary[] = projectList.map((proj) => {
    const projItems = items.filter((i) => i.projectId === proj.id);

    // Group items by category
    const catMap = new Map<string, ProjectCategoryBreakdown>();

    for (const item of projItems) {
      const approved = Number(item.approvedAmount);
      const realized = item.disbursementItems.reduce(
        (s, d) => s + Number(d.realizedAmount),
        0
      );
      const outstanding = Math.max(0, approved - realized);

      const existing = catMap.get(item.categoryId);
      if (existing) {
        existing.approvedAmount += approved;
        existing.realizedAmount += realized;
        existing.outstandingAmount += outstanding;
        existing.itemCount += 1;
      } else {
        catMap.set(item.categoryId, {
          categoryId: item.categoryId,
          categoryCode: item.category.code,
          categoryName: item.category.name,
          approvedAmount: approved,
          realizedAmount: realized,
          outstandingAmount: outstanding,
          itemCount: 1,
        });
      }
    }

    const categories = Array.from(catMap.values()).sort((a, b) =>
      a.categoryCode.localeCompare(b.categoryCode)
    );

    const approvedAmount = categories.reduce((s, c) => s + c.approvedAmount, 0);
    const realizedAmount = categories.reduce((s, c) => s + c.realizedAmount, 0);
    const outstandingAmount = categories.reduce((s, c) => s + c.outstandingAmount, 0);

    return {
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      confirmationStatus: proj.confirmationStatus,
      possibleParentCode: proj.possibleParentCode,
      approvedAmount,
      realizedAmount,
      outstandingAmount,
      itemCount: projItems.length,
      categories,
    };
  }).filter((p) => p.itemCount > 0 || (filters?.projectId && filters.projectId === p.projectId));

  const totalApproved = projects.reduce((s, p) => s + p.approvedAmount, 0);
  const totalRealized = projects.reduce((s, p) => s + p.realizedAmount, 0);
  const totalOutstanding = projects.reduce((s, p) => s + p.outstandingAmount, 0);

  let periodText = "Semua Periode";
  if (filters?.startDate && filters?.endDate) {
    periodText = `${filters.startDate} s.d. ${filters.endDate}`;
  } else if (filters?.startDate) {
    periodText = `Mulai ${filters.startDate}`;
  } else if (filters?.endDate) {
    periodText = `Sampai ${filters.endDate}`;
  }

  return {
    projects,
    totals: {
      totalApproved,
      totalRealized,
      totalOutstanding,
      projectCount: projects.length,
    },
    filterMeta: {
      periodText,
      projectText: filters?.projectId && filters.projectId !== "ALL" ? filters.projectId : "Semua Proyek",
      dataScopeText: scope === "ALL" ? "Semua Scope (REAL + TEST)" : String(scope),
    },
  };
}
