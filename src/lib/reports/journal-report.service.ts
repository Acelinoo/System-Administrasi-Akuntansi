import { prisma } from "../db/prisma";
import { JournalSourceType, TransactionStatus, DataScope } from "@prisma/client";

export interface JournalReportFilter {
  startDate?: string;
  endDate?: string;
  sourceType?: string;
  status?: string;
  coaId?: string;
  dataScope?: string;
}

export interface JournalReportRow {
  lineId: string;
  journalId: string;
  journalNumber: string;
  entryDate: Date;
  sourceType: JournalSourceType;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string | null;
  status: TransactionStatus;
}

export interface JournalReportResult {
  rows: JournalReportRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    entryCount: number;
  };
  filterMeta: {
    periodText: string;
    sourceText: string;
    statusText: string;
    accountText: string;
    dataScopeText: string;
  };
}

export async function getJournalReport(
  filters?: JournalReportFilter
): Promise<JournalReportResult> {
  const journalWhere: Record<string, unknown> = {};

  const scope = filters?.dataScope ? (filters.dataScope as DataScope | "ALL") : DataScope.REAL;
  if (scope !== "ALL") {
    journalWhere.dataScope = scope;
  }

  if (filters?.sourceType && filters.sourceType !== "ALL") {
    journalWhere.sourceType = filters.sourceType as JournalSourceType;
  }
  if (filters?.status && filters.status !== "ALL") {
    journalWhere.status = filters.status as TransactionStatus;
  }

  if (filters?.startDate || filters?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) {
      dateFilter.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      dateFilter.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
    journalWhere.entryDate = dateFilter;
  }

  const rawLines = await prisma.journalLine.findMany({
    where: {
      journal: journalWhere,
      ...(filters?.coaId && filters.coaId !== "ALL" ? { coaId: filters.coaId } : {}),
    },
    orderBy: [
      { journal: { entryDate: "desc" } },
      { journal: { journalNumber: "desc" } },
      { debit: "desc" },
    ],
    include: {
      journal: true,
      coa: true,
    },
  });

  const rows: JournalReportRow[] = rawLines.map((line) => ({
    lineId: line.id,
    journalId: line.journalId,
    journalNumber: line.journal.journalNumber,
    entryDate: line.journal.entryDate,
    sourceType: line.journal.sourceType,
    description: line.journal.description,
    accountCode: line.coa.accountCode,
    accountName: line.coa.accountName,
    debit: Number(line.debit),
    credit: Number(line.credit),
    memo: line.memo,
    status: line.journal.status,
  }));

  // Only POSTED transactions are counted in active financial totals (Financial Safety Invariant)
  const activeRows = rows.filter((r) => r.status === TransactionStatus.POSTED);
  const totalDebit = activeRows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = activeRows.reduce((s, r) => s + r.credit, 0);

  let periodText = "Semua Periode";
  if (filters?.startDate && filters?.endDate) {
    periodText = `${filters.startDate} s.d. ${filters.endDate}`;
  } else if (filters?.startDate) {
    periodText = `Mulai ${filters.startDate}`;
  } else if (filters?.endDate) {
    periodText = `Sampai ${filters.endDate}`;
  }

  return {
    rows,
    totals: {
      totalDebit,
      totalCredit,
      entryCount: rows.length,
    },
    filterMeta: {
      periodText,
      sourceText: filters?.sourceType && filters.sourceType !== "ALL" ? filters.sourceType : "Semua Sumber",
      statusText: filters?.status && filters.status !== "ALL" ? filters.status : "Semua Status",
      accountText: filters?.coaId && filters.coaId !== "ALL" ? filters.coaId : "Semua Akun COA",
      dataScopeText: scope === "ALL" ? "Semua Scope (REAL + TEST)" : String(scope),
    },
  };
}
