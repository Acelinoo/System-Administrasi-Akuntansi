import { getAllCashBalances } from "../finance/balance.service";
import { DataScope } from "@prisma/client";

export interface CashAccountReportItem {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  bankName: string | null;
  accountNumber: string | null;
  openingBalance: number;
  totalInflow: number;
  totalDisbursement: number;
  currentBalance: number;
}

export interface CashReportResult {
  accounts: CashAccountReportItem[];
  totals: {
    totalOpening: number;
    totalInflow: number;
    totalDisbursement: number;
    totalCurrentBalance: number;
  };
  filterMeta?: {
    dataScopeText: string;
  };
}

export async function getCashReport(filters?: { dataScope?: string; scope?: string }): Promise<CashReportResult> {
  const rawScope = filters?.dataScope || filters?.scope;
  const scope = rawScope ? (rawScope as DataScope | "ALL") : DataScope.REAL;
  const balances = await getAllCashBalances(undefined, scope);

  const accounts: CashAccountReportItem[] = balances.accounts.map((b) => ({
    id: b.accountId,
    accountCode: b.accountCode,
    accountName: b.accountName,
    accountType: b.accountType,
    bankName: b.bankName || null,
    accountNumber: b.accountNumber || null,
    openingBalance: b.openingBalance,
    totalInflow: b.totalInflow,
    totalDisbursement: b.totalDisbursement,
    currentBalance: b.currentBalance,
  }));

  const totalOpening = accounts.reduce((s, a) => s + a.openingBalance, 0);
  const totalInflow = accounts.reduce((s, a) => s + a.totalInflow, 0);
  const totalDisbursement = accounts.reduce((s, a) => s + a.totalDisbursement, 0);
  const totalCurrentBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  return {
    accounts,
    totals: {
      totalOpening,
      totalInflow,
      totalDisbursement,
      totalCurrentBalance,
    },
    filterMeta: {
      dataScopeText: scope === "ALL" ? "Semua Scope (REAL + TEST)" : String(scope),
    },
  };
}
