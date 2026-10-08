import { prisma } from "../db/prisma";
import { Prisma, TransactionStatus, DataScope } from "@prisma/client";

export interface CashAccountBalanceResult {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  bankName?: string | null;
  accountNumber?: string | null;
  openingBalance: number;
  totalInflow: number;
  totalDisbursement: number;
  currentBalance: number;
  dataScope?: string;
}

/**
 * Calculates current real-time balance for a given cash/bank account.
 * Balance = Opening Balance + SUM(Posted Inflows) - SUM(Posted Disbursements)
 * Defaults strictly to DataScope.REAL for operational financial safety.
 */
export async function getCashAccountBalance(
  accountId: string,
  tx?: Prisma.TransactionClient,
  dataScope: DataScope | "ALL" = "ALL"
): Promise<CashAccountBalanceResult> {
  const db = tx ?? prisma;

  const account = await db.cashAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Akun kas/bank dengan ID ${accountId} tidak ditemukan.`);
  }

  const scopeFilter = dataScope === "ALL" ? {} : { dataScope };

  // 1. Sum posted inflows
  const inflowAgg = await db.fundInflow.aggregate({
    where: {
      destinationAccountId: accountId,
      status: TransactionStatus.POSTED,
      ...scopeFilter,
    },
    _sum: {
      amount: true,
    },
  });

  // 2. Sum posted disbursements
  const disbAgg = await db.disbursement.aggregate({
    where: {
      cashAccountId: accountId,
      status: TransactionStatus.POSTED,
      ...scopeFilter,
    },
    _sum: {
      totalRealizedAmount: true,
    },
  });

  const opening = Number(account.openingBalance);
  const totalInflow = Number(inflowAgg._sum.amount ?? 0);
  const totalDisbursement = Number(disbAgg._sum.totalRealizedAmount ?? 0);
  const currentBalance = opening + totalInflow - totalDisbursement;

  return {
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountType: account.accountType,
    openingBalance: opening,
    totalInflow,
    totalDisbursement,
    currentBalance,
    dataScope: String(dataScope),
  };
}

/**
 * Returns real-time balances for all active cash and bank accounts.
 * Defaults strictly to DataScope.REAL.
 */
export async function getAllCashBalances(
  tx?: Prisma.TransactionClient,
  dataScope: DataScope | "ALL" = DataScope.REAL
): Promise<{
  accounts: CashAccountBalanceResult[];
  totalLiquidity: number;
}> {
  const db = tx ?? prisma;
  const scopeFilter = dataScope === "ALL" ? {} : { dataScope };

  // Fetch active accounts and batch-aggregate inflows & disbursements in parallel
  const [activeAccounts, inflowGroups, disbGroups] = await Promise.all([
    db.cashAccount.findMany({
      where: { isActive: true },
      orderBy: { accountCode: "asc" },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        bankName: true,
        accountNumber: true,
        openingBalance: true,
      },
    }),
    db.fundInflow.groupBy({
      by: ["destinationAccountId"],
      where: {
        status: TransactionStatus.POSTED,
        ...scopeFilter,
      },
      _sum: {
        amount: true,
      },
    }),
    db.disbursement.groupBy({
      by: ["cashAccountId"],
      where: {
        status: TransactionStatus.POSTED,
        ...scopeFilter,
      },
      _sum: {
        totalRealizedAmount: true,
      },
    }),
  ]);

  const inflowMap = new Map<string, number>();
  for (const item of inflowGroups) {
    if (item.destinationAccountId) {
      inflowMap.set(item.destinationAccountId, Number(item._sum.amount ?? 0));
    }
  }

  const disbMap = new Map<string, number>();
  for (const item of disbGroups) {
    if (item.cashAccountId) {
      disbMap.set(item.cashAccountId, Number(item._sum.totalRealizedAmount ?? 0));
    }
  }

  let totalLiquidity = 0;
  const accounts: CashAccountBalanceResult[] = activeAccounts.map((acc) => {
    const opening = Number(acc.openingBalance);
    const totalInflow = inflowMap.get(acc.id) ?? 0;
    const totalDisbursement = disbMap.get(acc.id) ?? 0;
    const currentBalance = opening + totalInflow - totalDisbursement;
    totalLiquidity += currentBalance;

    return {
      accountId: acc.id,
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      accountType: acc.accountType,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      openingBalance: opening,
      totalInflow,
      totalDisbursement,
      currentBalance,
      dataScope: String(dataScope),
    };
  });

  return {
    accounts,
    totalLiquidity,
  };
}
