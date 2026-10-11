import { prisma } from "../db/prisma";
import {
  TransactionStatus,
  DataScope,
  TerminStatus,
  Prisma,
} from "@prisma/client";
import { createFundInflow } from "./inflow.service";

export interface ProjectCostControlMetrics {
  contractValue: number | null;
  totalRapBudget: number;
  totalPostedInflow: number;
  totalPostedExpense: number;
  totalAccApproved: number;
  totalAccOutstanding: number;
  remainingContractValue: number | null; // Nilai Kontrak - Penerimaan Aktual
  netInflowBalance: number; // Penerimaan Aktual - Pengeluaran Aktual
  remainingTerminUnreceived: number; // Sisa termin belum diterima dari data termin
  receiptProgressPct: number | null; // Penerimaan Aktual / Nilai Kontrak * 100%
  physicalProgressPct: number | null; // Dari opname fisik bagian sipil terbaru (null jika belum ada)
  remainingRapBudget: number | null; // Total RAP - Pengeluaran Aktual
  budgetBurnRatePct: number | null; // (Pengeluaran Aktual / Total RAP) * 100%
  costVarianceStatus: "HEALTHY" | "WARNING" | "OVERBUDGET" | "NO_BUDGET";
  scheduleElapsedPct: number | null; // Estimasi linier durasi jadwal kontrak yang telah berjalan
  scheduleLagPct: number | null; // Selisih scheduleElapsedPct - physicalProgressPct
  isScheduleLagging: boolean; // True jika progres fisik tertinggal > 10% dari estimasi jadwal
  hasBudget: boolean;
  hasProgressLog: boolean;
}

export interface ProjectCategoryCostItem {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  budgetAmount: number; // dari RAP jika ada
  approvedAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  variance: number; // budgetAmount - realizedAmount (jika ada RAP)
  status: "NORMAL" | "WARNING" | "EXCEEDED";
}

export interface EnrichedVendorContract {
  id: string;
  vendorId: string;
  projectId: string | null;
  contractNumber: string;
  title: string;
  contractValue: number;
  paidAmount: number;
  remainingBalance: number;
  paymentProgressPct: number;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  vendor: {
    id: string;
    name: string;
    code: string | null;
    type: string;
  };
}

export async function getProject360Data(
  projectId: string,
  dataScope: DataScope | "ALL" = DataScope.REAL
) {
  const scopeFilter = dataScope === "ALL" ? {} : { dataScope };

  // 1. Fetch Project with SubUnits
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      subUnits: {
        where: { isActive: true },
        orderBy: { code: "asc" },
      },
    },
  });

  if (!project) {
    return null;
  }

  // 2. Parallel queries for all project dimensions
  const [
    budgets,
    termins,
    progressLogs,
    vendorContracts,
    fundInflows,
    accItems,
    journalLines,
  ] = await Promise.all([
    // Budgets & Items
    prisma.projectBudget.findMany({
      where: { projectId, ...scopeFilter },
      include: {
        items: {
          orderBy: [{ itemCode: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    // Termins
    prisma.projectTermin.findMany({
      where: { projectId },
      include: {
        fundInflow: {
          select: {
            id: true,
            inflowNumber: true,
            inflowDate: true,
            amount: true,
            status: true,
            sourceInfo: true,
          },
        },
      },
      orderBy: { terminNumber: "asc" },
    }),

    // Physical Progress Logs (Civil Engineering)
    prisma.projectProgressLog.findMany({
      where: { projectId },
      orderBy: { logDate: "desc" },
    }),

    // Vendor Contracts
    prisma.vendorContract.findMany({
      where: { projectId },
      include: {
        vendor: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    // Fund Inflows linked to this project (POSTED only for financial truth)
    prisma.fundInflow.findMany({
      where: {
        projectId,
        ...scopeFilter,
        status: TransactionStatus.POSTED,
      },
      include: {
        destinationAccount: {
          select: { id: true, accountName: true, accountCode: true },
        },
      },
      orderBy: { inflowDate: "desc" },
    }),

    // ACC Expense Items
    prisma.accExpenseItem.findMany({
      where: {
        projectId,
        ...scopeFilter,
      },
      include: {
        category: true,
        subCategory: true,
        pic: true,
        subUnit: true,
        batch: {
          select: { id: true, noKas: true, accDate: true, batchCode: true },
        },
        expenseItemDetails: {
          include: {
            vendor: { select: { id: true, name: true, code: true } },
          },
        },
        disbursementItems: {
          where: {
            disbursement: { status: TransactionStatus.POSTED },
          },
          include: {
            disbursement: {
              select: {
                id: true,
                disbursementNumber: true,
                disbursementDate: true,
                paymentMethod: true,
                cashAccount: { select: { accountName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),

    // Project Journal Lines (Single-entry projection from General Ledger)
    prisma.journalLine.findMany({
      where: {
        projectId,
        journal: {
          ...scopeFilter,
          status: TransactionStatus.POSTED,
        },
      },
      include: {
        journal: true,
        coa: true,
      },
      orderBy: [
        { journal: { entryDate: "desc" } },
        { journal: { journalNumber: "desc" } },
      ],
    }),
  ]);

  // 3. Financial Metrics Calculations (following Golden Invariants)
  const contractValue = project.contractValue ? Number(project.contractValue) : null;

  // Active Budget = Latest budget version (ordered by createdAt desc)
  const activeBudget = budgets.length > 0 ? budgets[0] : null;

  // Total RAP budget from active (latest) budget version (not summing across all historical revisions)
  const totalRapBudget = activeBudget
    ? activeBudget.items.reduce((itemSum, it) => itemSum + Number(it.totalAmount), 0)
    : 0;

  // Total Realized Inflows (Posted FundInflows)
  const totalPostedInflow = fundInflows.reduce((sum, inf) => sum + Number(inf.amount), 0);

  // Total Realized Expenses (Posted Disbursement Items)
  let totalPostedExpense = 0;
  let totalAccApproved = 0;

  accItems.forEach((item) => {
    totalAccApproved += Number(item.approvedAmount);
    const itemRealized = item.disbursementItems.reduce(
      (sum, di) => sum + Number(di.realizedAmount),
      0
    );
    totalPostedExpense += itemRealized;
  });

  const totalAccOutstanding = Math.max(0, totalAccApproved - totalPostedExpense);

  // Sisa Nilai Kontrak = Nilai Kontrak - Penerimaan yang telah diterima
  const remainingContractValue =
    contractValue !== null ? Math.max(0, contractValue - totalPostedInflow) : null;

  // Saldo Penerimaan Bersih = Penerimaan yang telah diposting - Pengeluaran yang telah diposting
  const netInflowBalance = totalPostedInflow - totalPostedExpense;

  // Sisa Termin Belum Diterima
  let totalPlannedTermin = 0;
  let totalReceivedTermin = 0;
  termins.forEach((t) => {
    totalPlannedTermin += Number(t.plannedAmount);
    if (t.status === TerminStatus.RECEIVED && t.receivedAmount) {
      totalReceivedTermin += Number(t.receivedAmount);
    }
  });
  const remainingTerminUnreceived = Math.max(0, totalPlannedTermin - totalReceivedTermin);

  // Progress Penerimaan
  const receiptProgressPct =
    contractValue !== null && contractValue > 0
      ? (totalPostedInflow / contractValue) * 100
      : null;

  // Progress Fisik (dari log sipil terbaru)
  const latestProgressLog = progressLogs.length > 0 ? progressLogs[0] : null;
  const physicalProgressPct = latestProgressLog
    ? Number(latestProgressLog.physicalProgressPct)
    : null;

  // Sisa Anggaran RAP
  const remainingRapBudget = totalRapBudget > 0 ? totalRapBudget - totalPostedExpense : null;

  // Budget Burn Rate (% realisasi terhadap RAP)
  const budgetBurnRatePct =
    totalRapBudget > 0 ? (totalPostedExpense / totalRapBudget) * 100 : null;

  // Cost Variance Status
  let costVarianceStatus: "HEALTHY" | "WARNING" | "OVERBUDGET" | "NO_BUDGET" = "NO_BUDGET";
  if (totalRapBudget > 0) {
    if (totalPostedExpense > totalRapBudget) {
      costVarianceStatus = "OVERBUDGET";
    } else if (totalPostedExpense >= totalRapBudget * 0.9) {
      costVarianceStatus = "WARNING";
    } else {
      costVarianceStatus = "HEALTHY";
    }
  }

  // Schedule timeline elapsed & schedule lag
  let scheduleElapsedPct: number | null = null;
  let scheduleLagPct: number | null = null;
  if (project.targetStartDate && project.targetEndDate) {
    const start = new Date(project.targetStartDate).getTime();
    const end = new Date(project.targetEndDate).getTime();
    const now = Date.now();
    if (end > start) {
      const elapsed = ((now - start) / (end - start)) * 100;
      scheduleElapsedPct = Math.min(100, Math.max(0, Math.round(elapsed * 10) / 10));
      if (physicalProgressPct !== null) {
        scheduleLagPct = Math.round((scheduleElapsedPct - physicalProgressPct) * 10) / 10;
      }
    }
  }

  const isScheduleLagging = scheduleLagPct !== null && scheduleLagPct > 10;
  const hasBudget = totalRapBudget > 0;
  const hasProgressLog = physicalProgressPct !== null;

  const metrics: ProjectCostControlMetrics = {
    contractValue,
    totalRapBudget,
    totalPostedInflow,
    totalPostedExpense,
    totalAccApproved,
    totalAccOutstanding,
    remainingContractValue,
    netInflowBalance,
    remainingTerminUnreceived,
    receiptProgressPct,
    physicalProgressPct,
    remainingRapBudget,
    budgetBurnRatePct,
    costVarianceStatus,
    scheduleElapsedPct,
    scheduleLagPct,
    isScheduleLagging,
    hasBudget,
    hasProgressLog,
  };

  // 4. Group Expenses by Category & Map to Active RAP if available
  const rapCatMap = new Map<string, number>();
  if (activeBudget) {
    activeBudget.items.forEach((it) => {
      if (it.category) {
        const catKey = it.category.toUpperCase().trim();
        rapCatMap.set(catKey, (rapCatMap.get(catKey) ?? 0) + Number(it.totalAmount));
      }
    });
  }

  const categoryMap = new Map<string, ProjectCategoryCostItem>();
  accItems.forEach((item) => {
    const cat = item.category;
    const approved = Number(item.approvedAmount);
    const realized = item.disbursementItems.reduce(
      (sum, di) => sum + Number(di.realizedAmount),
      0
    );
    const outstanding = Math.max(0, approved - realized);

    const existing = categoryMap.get(cat.id);
    if (existing) {
      existing.approvedAmount += approved;
      existing.realizedAmount += realized;
      existing.outstandingAmount += outstanding;
    } else {
      const budgetAmount = rapCatMap.get(cat.code.toUpperCase().trim()) ?? 0;
      categoryMap.set(cat.id, {
        categoryId: cat.id,
        categoryCode: cat.code,
        categoryName: cat.name,
        budgetAmount,
        approvedAmount: approved,
        realizedAmount: realized,
        outstandingAmount: outstanding,
        variance: budgetAmount > 0 ? budgetAmount - realized : 0,
        status:
          budgetAmount > 0 && realized > budgetAmount
            ? "EXCEEDED"
            : budgetAmount > 0 && realized > budgetAmount * 0.9
            ? "WARNING"
            : "NORMAL",
      });
    }
  });

  // Also include any categories from active RAP that do not have expenses yet
  rapCatMap.forEach((budgetAmount, catKey) => {
    const alreadyMapped = Array.from(categoryMap.values()).some(
      (c) => c.categoryCode.toUpperCase().trim() === catKey
    );
    if (!alreadyMapped) {
      categoryMap.set(`budget-${catKey}`, {
        categoryId: `budget-${catKey}`,
        categoryCode: catKey,
        categoryName: catKey,
        budgetAmount,
        approvedAmount: 0,
        realizedAmount: 0,
        outstandingAmount: 0,
        variance: budgetAmount,
        status: "NORMAL",
      });
    }
  });

  const categoryCostBreakdown = Array.from(categoryMap.values()).map((c) => ({
    ...c,
    variance: c.budgetAmount > 0 ? c.budgetAmount - c.realizedAmount : 0,
    status:
      c.budgetAmount > 0 && c.realizedAmount > c.budgetAmount
        ? ("EXCEEDED" as const)
        : c.budgetAmount > 0 && c.realizedAmount > c.budgetAmount * 0.9
        ? ("WARNING" as const)
        : ("NORMAL" as const),
  }));

  // 5. Gather all material/itemized details
  const formattedAccItems = accItems.map((ai) => ({
    ...ai,
    itemDetails: ai.expenseItemDetails,
  }));

  const allItemDetails = accItems.flatMap((ai) =>
    ai.expenseItemDetails.map((det) => ({
      ...det,
      accItemNoKas: ai.noKas,
      accItemDescription: ai.description,
      picName: ai.pic.name,
      categoryName: ai.category.name,
    }))
  );

  // 6. Enrich Vendor Contracts with Realized Payments & Remaining Balances
  const enrichedVendorContracts: EnrichedVendorContract[] = vendorContracts.map((vc) => {
    const contractVal = Number(vc.contractValue);
    let paidAmount = 0;

    accItems.forEach((ai) => {
      const approvedAmt = Number(ai.approvedAmount);
      const itemRealized = ai.disbursementItems.reduce(
        (sum, di) => sum + Number(di.realizedAmount),
        0
      );
      if (itemRealized <= 0 || approvedAmt <= 0) return;

      const realizationRatio = Math.min(1, itemRealized / approvedAmt);

      const matchingDetails = ai.expenseItemDetails.filter(
        (det) => det.vendorId === vc.vendorId
      );
      matchingDetails.forEach((det) => {
        const detailTotal = Number(det.totalPrice);
        const paidForDetail = Math.round(detailTotal * realizationRatio * 100) / 100;
        paidAmount += paidForDetail;
      });
    });

    paidAmount = Math.round(paidAmount * 100) / 100;
    const remainingBalance = Math.max(0, contractVal - paidAmount);
    const paymentProgressPct =
      contractVal > 0 ? Math.min(100, Math.round((paidAmount / contractVal) * 1000) / 10) : 0;

    return {
      id: vc.id,
      vendorId: vc.vendorId,
      projectId: vc.projectId,
      contractNumber: vc.contractNumber,
      title: vc.title,
      contractValue: contractVal,
      paidAmount,
      remainingBalance,
      paymentProgressPct,
      startDate: vc.startDate,
      endDate: vc.endDate,
      status: vc.status,
      notes: vc.notes,
      createdAt: vc.createdAt,
      updatedAt: vc.updatedAt,
      vendor: vc.vendor,
    };
  });

  return {
    project,
    metrics,
    categoryCostBreakdown,
    budgets,
    activeBudgetId: activeBudget ? activeBudget.id : null,
    termins,
    progressLogs,
    vendorContracts: enrichedVendorContracts,
    fundInflows,
    accItems: formattedAccItems,
    journalLines,
    allItemDetails,
  };
}

// ==========================================
// MUTATION SERVICES (RAP, TERMIN, PROGRESS, DETAILS)
// ==========================================

export async function createProjectBudget(data: {
  projectId: string;
  title?: string;
  budgetName?: string;
  version?: number;
  notes?: string | null;
  items?: Array<{
    itemCode?: string | null;
    description: string;
    category?: string | null;
    volume: number;
    unit: string;
    unitPrice: number;
  }>;
  dataScope?: DataScope;
}) {
  const title = (data.title || data.budgetName || "Anggaran Proyek (RAP)").trim();
  const items = data.items ?? [];
  const calculatedTotal = items.reduce(
    (sum, it) => sum + Math.round(Number(it.volume) * Number(it.unitPrice) * 100) / 100,
    0
  );

  const budget = await prisma.projectBudget.create({
    data: {
      projectId: data.projectId,
      title,
      notes: data.notes ?? null,
      totalBudget: calculatedTotal,
      dataScope: data.dataScope ?? DataScope.REAL,
      items: {
        create: items.map((it) => {
          const total = Math.round(Number(it.volume) * Number(it.unitPrice) * 100) / 100;
          return {
            itemCode: it.itemCode ?? null,
            description: it.description,
            category: it.category ?? null,
            volume: it.volume,
            unit: it.unit || "ls",
            unitPrice: it.unitPrice,
            totalAmount: total,
          };
        }),
      },
    },
    include: {
      items: true,
    },
  });

  return {
    ...budget,
    budgetName: budget.title,
  };
}

export async function addBudgetItem(data: {
  budgetId: string;
  itemCode?: string | null;
  description: string;
  category?: string | null;
  volume: number;
  unit: string;
  unitPrice: number;
}) {
  const totalAmount = Math.round(Number(data.volume) * Number(data.unitPrice) * 100) / 100;

  return await prisma.$transaction(async (tx) => {
    const item = await tx.budgetItem.create({
      data: {
        budgetId: data.budgetId,
        itemCode: data.itemCode ?? null,
        description: data.description,
        category: data.category ?? null,
        volume: data.volume,
        unit: data.unit,
        unitPrice: data.unitPrice,
        totalAmount,
      },
    });

    // Recalculate parent budget total
    const allItems = await tx.budgetItem.findMany({
      where: { budgetId: data.budgetId },
      select: { totalAmount: true },
    });
    const newTotal = allItems.reduce((s, it) => s + Number(it.totalAmount), 0);

    await tx.projectBudget.update({
      where: { id: data.budgetId },
      data: { totalBudget: newTotal },
    });

    return item;
  });
}

export async function deleteBudgetItem(itemId: string) {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.budgetItem.findUnique({
      where: { id: itemId },
    });
    if (!item) return null;

    const budgetId = item.budgetId;
    await tx.budgetItem.delete({ where: { id: itemId } });

    // Recalculate parent total
    const remaining = await tx.budgetItem.findMany({
      where: { budgetId },
      select: { totalAmount: true },
    });
    const newTotal = remaining.reduce((s, it) => s + Number(it.totalAmount), 0);

    await tx.projectBudget.update({
      where: { id: budgetId },
      data: { totalBudget: newTotal },
    });

    return true;
  });
}

export async function deleteProjectBudget(budgetId: string) {
  return await prisma.projectBudget.delete({
    where: { id: budgetId },
  });
}

export async function createProjectTermin(data: {
  projectId: string;
  terminNumber: number;
  name: string;
  plannedAmount: number;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  notes?: string | null;
}) {
  return await prisma.projectTermin.create({
    data: {
      projectId: data.projectId,
      terminNumber: data.terminNumber,
      name: data.name,
      plannedAmount: data.plannedAmount,
      invoiceNumber: data.invoiceNumber ?? null,
      invoiceDate: data.invoiceDate ?? null,
      status: data.invoiceNumber ? TerminStatus.INVOICED : TerminStatus.PLANNED,
      notes: data.notes ?? null,
    },
  });
}

export async function recordTerminPayment(data: {
  terminId: string;
  destinationAccountId: string;
  amount: number;
  receivedDate: Date;
  referenceNo?: string | null;
  notes?: string | null;
  dataScope?: DataScope;
}) {
  return await prisma.$transaction(async (tx) => {
    const termin = await tx.projectTermin.findUnique({
      where: { id: data.terminId },
      include: { project: true },
    });

    if (!termin) {
      throw new Error(`Termin dengan ID ${data.terminId} tidak ditemukan.`);
    }

    if (termin.status === TerminStatus.RECEIVED) {
      throw new Error(`Termin '${termin.name}' sudah berstatus RECEIVED / telah lunas.`);
    }

    // 1. Create a genuine POSTED FundInflow so cash increases and journal is generated!
    const inflow = await createFundInflow(
      {
        inflowDate: data.receivedDate,
        destinationAccountId: data.destinationAccountId,
        projectId: termin.projectId,
        amount: data.amount,
        sourceInfo: `Penerimaan ${termin.name} - ${termin.project.name}`,
        referenceNo: data.referenceNo ?? termin.invoiceNumber ?? undefined,
        dataScope: data.dataScope,
      },
      tx
    );

    // 2. Link FundInflow to Termin
    const updatedTermin = await tx.projectTermin.update({
      where: { id: termin.id },
      data: {
        status: TerminStatus.RECEIVED,
        fundInflowId: inflow.id,
        receivedAmount: data.amount,
        receivedDate: data.receivedDate,
        notes: data.notes ?? termin.notes,
      },
    });

    return { termin: updatedTermin, inflow };
  });
}

export async function createProjectProgressLog(data: {
  projectId: string;
  logDate: Date;
  physicalProgressPct: number;
  volumeDescription?: string | null;
  sourceInfo?: string | null;
  notes?: string | null;
}) {
  if (data.physicalProgressPct < 0 || data.physicalProgressPct > 100) {
    throw new Error("Persentase progres fisik harus berada di antara 0% dan 100%.");
  }

  return await prisma.projectProgressLog.create({
    data: {
      projectId: data.projectId,
      logDate: data.logDate,
      physicalProgressPct: data.physicalProgressPct,
      volumeDescription: data.volumeDescription ?? null,
      sourceInfo: data.sourceInfo ?? "Bagian Sipil / Lapangan",
      notes: data.notes ?? null,
    },
  });
}

export async function createExpenseItemDetail(data: {
  accItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vendorId?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
}) {
  const accItem = await prisma.accExpenseItem.findUnique({
    where: { id: data.accItemId },
  });

  if (!accItem) {
    throw new Error(`Item pengeluaran ACC dengan ID '${data.accItemId}' tidak ditemukan.`);
  }

  if (Number(data.quantity) <= 0) {
    throw new Error("Kuantitas barang harus lebih besar dari 0.");
  }

  if (Number(data.unitPrice) < 0) {
    throw new Error("Harga satuan barang tidak boleh negatif.");
  }

  if (data.vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: data.vendorId },
    });
    if (!vendor) {
      throw new Error(`Vendor rekanan dengan ID '${data.vendorId}' tidak ditemukan.`);
    }
  }

  const totalPrice = Math.round(Number(data.quantity) * Number(data.unitPrice) * 100) / 100;

  return await prisma.expenseItemDetail.create({
    data: {
      accItemId: data.accItemId,
      itemName: data.itemName.trim(),
      quantity: data.quantity,
      unit: (data.unit || "bh").trim(),
      unitPrice: data.unitPrice,
      totalPrice,
      vendorId: data.vendorId ?? null,
      referenceNo: data.referenceNo?.trim() ?? null,
      notes: data.notes?.trim() ?? null,
    },
  });
}

export async function deleteExpenseItemDetail(detailId: string) {
  const detail = await prisma.expenseItemDetail.findUnique({
    where: { id: detailId },
  });
  if (!detail) {
    throw new Error(`Rincian barang dengan ID '${detailId}' tidak ditemukan.`);
  }

  return await prisma.expenseItemDetail.delete({
    where: { id: detailId },
  });
}

export async function createVendorContract(data: {
  vendorId: string;
  projectId?: string | null;
  contractNumber: string;
  title: string;
  contractValue: number;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: string;
  notes?: string | null;
}) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: data.vendorId },
  });
  if (!vendor) {
    throw new Error(`Vendor rekanan dengan ID '${data.vendorId}' tidak ditemukan.`);
  }

  if (data.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });
    if (!project) {
      throw new Error(`Proyek dengan ID '${data.projectId}' tidak ditemukan.`);
    }
  }

  if (Number(data.contractValue) <= 0) {
    throw new Error("Nilai kontrak vendor harus lebih besar dari 0.");
  }

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    throw new Error("Tanggal mulai kontrak tidak boleh melebihi tanggal selesai.");
  }

  return await prisma.vendorContract.create({
    data: {
      vendorId: data.vendorId,
      projectId: data.projectId ?? null,
      contractNumber: data.contractNumber.trim(),
      title: data.title.trim(),
      contractValue: data.contractValue,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      status: data.status || "ACTIVE",
      notes: data.notes?.trim() ?? null,
    },
  });
}

export async function deleteVendorContract(contractId: string) {
  const contract = await prisma.vendorContract.findUnique({
    where: { id: contractId },
  });
  if (!contract) {
    throw new Error(`Kontrak vendor dengan ID '${contractId}' tidak ditemukan.`);
  }

  return await prisma.vendorContract.delete({
    where: { id: contractId },
  });
}
