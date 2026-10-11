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
  clientName?: string | null;
  projectType?: string | null;
  contractValue: number | null;
  totalInflow: number;
  netBalance: number;
  remainingContract: number | null;
  receiptProgressPct: number | null;
  physicalProgressPct: number | null;
  targetStartDate?: Date | null;
  targetEndDate?: Date | null;
  scheduleElapsedPct?: number | null;
  totalBudget: number;
  remainingBudget: number | null;
  budgetBurnRatePct: number | null;
  costVarianceStatus: "HEALTHY" | "WARNING" | "OVERBUDGET" | "NO_BUDGET";
  hasBudget: boolean;
  hasProgressLog: boolean;
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  itemCount: number;
  categories: ProjectCategoryBreakdown[];
}

export interface ProjectReportResult {
  projects: ProjectReportSummary[];
  allProjects: Array<{ id: string; code: string; name: string }>;
  totals: {
    totalContractValue: number;
    totalBudget: number;
    totalRemainingBudget: number;
    totalInflow: number;
    totalNetBalance: number;
    totalApproved: number;
    totalRealized: number;
    totalOutstanding: number;
    projectCount: number;
    overBudgetCount: number;
    warningBudgetCount: number;
    healthyBudgetCount: number;
    noBudgetCount: number;
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
  scope?: string;
}): Promise<ProjectReportResult> {
  const where: Record<string, unknown> = {};

  const rawScope = filters?.dataScope || filters?.scope;
  const scope = rawScope ? (rawScope as DataScope | "ALL") : DataScope.REAL;
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

  // 1. Run queries in parallel
  const [projectList, allActiveProjects, items, postedInflows, progressLogs, budgets] = await Promise.all([
    // Projects to show in report (filtered if specific project selected)
    prisma.project.findMany({
      where: filters?.projectId && filters.projectId !== "ALL" ? { id: filters.projectId } : { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        confirmationStatus: true,
        possibleParentCode: true,
        clientName: true,
        projectType: true,
        contractValue: true,
        targetStartDate: true,
        targetEndDate: true,
      },
      orderBy: { code: "asc" },
    }),
    // All active projects for filter dropdown
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    // Optimized items fetch: select only needed fields
    prisma.accExpenseItem.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        categoryId: true,
        approvedAmount: true,
        category: {
          select: { id: true, code: true, name: true },
        },
        disbursementItems: {
          where: { disbursement: { status: TransactionStatus.POSTED } },
          select: { realizedAmount: true },
        },
      },
    }),
    // Posted inflows linked to projects
    prisma.fundInflow.findMany({
      where: {
        status: TransactionStatus.POSTED,
        projectId: { not: null },
        ...(scope !== "ALL" ? { dataScope: scope } : {}),
      },
      select: {
        projectId: true,
        amount: true,
      },
    }),
    // Latest physical progress logs
    prisma.projectProgressLog.findMany({
      orderBy: { logDate: "desc" },
      select: {
        projectId: true,
        physicalProgressPct: true,
        logDate: true,
      },
    }),
    // Budgets & items (ordered by createdAt desc to select active budget version)
    prisma.projectBudget.findMany({
      where: scope !== "ALL" ? { dataScope: scope } : {},
      orderBy: { createdAt: "desc" },
      select: {
        projectId: true,
        items: {
          select: { totalAmount: true },
        },
      },
    }),
  ]);

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

    // Inflows for this project
    const projInflows = postedInflows.filter((inf) => inf.projectId === proj.id);
    const totalInflow = projInflows.reduce((s, inf) => s + Number(inf.amount), 0);
    const netBalance = totalInflow - realizedAmount;

    // Contract value & remaining
    const contractVal = proj.contractValue ? Number(proj.contractValue) : null;
    const remainingContract = contractVal !== null ? Math.max(0, contractVal - totalInflow) : null;

    // Receipt progress
    const receiptProgressPct =
      contractVal !== null && contractVal > 0 ? (totalInflow / contractVal) * 100 : null;

    // Physical progress (civil)
    const latestLog = progressLogs.find((pl) => pl.projectId === proj.id);
    const physicalProgressPct = latestLog ? Number(latestLog.physicalProgressPct) : null;

    // Budget total & remaining from active (latest) budget version
    const projBudgets = budgets.filter((b) => b.projectId === proj.id);
    const activeBudget = projBudgets.length > 0 ? projBudgets[0] : null;
    const totalBudget = activeBudget
      ? activeBudget.items.reduce((is, it) => is + Number(it.totalAmount), 0)
      : 0;
    const remainingBudget = totalBudget > 0 ? totalBudget - realizedAmount : null;
    const budgetBurnRatePct = totalBudget > 0 ? (realizedAmount / totalBudget) * 100 : null;

    let costVarianceStatus: "HEALTHY" | "WARNING" | "OVERBUDGET" | "NO_BUDGET" = "NO_BUDGET";
    if (totalBudget > 0) {
      if (realizedAmount > totalBudget) {
        costVarianceStatus = "OVERBUDGET";
      } else if (realizedAmount >= totalBudget * 0.9) {
        costVarianceStatus = "WARNING";
      } else {
        costVarianceStatus = "HEALTHY";
      }
    }

    let scheduleElapsedPct: number | null = null;
    if (proj.targetStartDate && proj.targetEndDate) {
      const start = new Date(proj.targetStartDate).getTime();
      const end = new Date(proj.targetEndDate).getTime();
      const now = Date.now();
      if (end > start) {
        const elapsed = ((now - start) / (end - start)) * 100;
        scheduleElapsedPct = Math.min(100, Math.max(0, Math.round(elapsed * 10) / 10));
      }
    }

    return {
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      confirmationStatus: proj.confirmationStatus,
      possibleParentCode: proj.possibleParentCode,
      clientName: proj.clientName,
      projectType: proj.projectType,
      contractValue: contractVal,
      totalInflow,
      netBalance,
      remainingContract,
      receiptProgressPct,
      physicalProgressPct,
      targetStartDate: proj.targetStartDate,
      targetEndDate: proj.targetEndDate,
      scheduleElapsedPct,
      totalBudget,
      remainingBudget,
      budgetBurnRatePct,
      costVarianceStatus,
      hasBudget: totalBudget > 0,
      hasProgressLog: physicalProgressPct !== null,
      approvedAmount,
      realizedAmount,
      outstandingAmount,
      itemCount: projItems.length,
      categories,
    };
  }).filter((p) => p.itemCount > 0 || (filters?.projectId && filters.projectId === p.projectId) || (p.contractValue !== null && p.contractValue > 0) || p.totalBudget > 0);

  const totalContractValue = projects.reduce((s, p) => s + (p.contractValue ?? 0), 0);
  const totalBudget = projects.reduce((s, p) => s + p.totalBudget, 0);
  const totalRemainingBudget = projects.reduce((s, p) => s + (p.remainingBudget ?? 0), 0);
  const totalInflow = projects.reduce((s, p) => s + p.totalInflow, 0);
  const totalNetBalance = projects.reduce((s, p) => s + p.netBalance, 0);
  const totalApproved = projects.reduce((s, p) => s + p.approvedAmount, 0);
  const totalRealized = projects.reduce((s, p) => s + p.realizedAmount, 0);
  const totalOutstanding = projects.reduce((s, p) => s + p.outstandingAmount, 0);

  const overBudgetCount = projects.filter((p) => p.costVarianceStatus === "OVERBUDGET").length;
  const warningBudgetCount = projects.filter((p) => p.costVarianceStatus === "WARNING").length;
  const healthyBudgetCount = projects.filter((p) => p.costVarianceStatus === "HEALTHY").length;
  const noBudgetCount = projects.filter((p) => p.costVarianceStatus === "NO_BUDGET").length;

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
    allProjects: allActiveProjects,
    totals: {
      totalContractValue,
      totalBudget,
      totalRemainingBudget,
      totalInflow,
      totalNetBalance,
      totalApproved,
      totalRealized,
      totalOutstanding,
      projectCount: projects.length,
      overBudgetCount,
      warningBudgetCount,
      healthyBudgetCount,
      noBudgetCount,
    },
    filterMeta: {
      periodText,
      projectText: filters?.projectId && filters.projectId !== "ALL" ? filters.projectId : "Semua Proyek",
      dataScopeText: scope === "ALL" ? "Semua Scope (REAL + TEST)" : String(scope),
    },
  };
}
