import { prisma } from "../db/prisma";
import {
  Prisma,
  JournalSourceType,
  TransactionStatus,
  AccountType,
  DataScope,
} from "@prisma/client";

export interface JournalLineDraft {
  coaId: string;
  projectId?: string | null;
  debit: number;
  credit: number;
  memo?: string | null;
}

export interface CreateJournalEntryOptions {
  journalNumber?: string;
  entryDate: Date;
  sourceType: JournalSourceType;
  sourceId: string;
  description: string;
  lines: JournalLineDraft[];
  tx?: Prisma.TransactionClient;
  dataScope?: DataScope;
}

/**
 * Creates a balanced, idempotent double-entry Journal Entry with Journal Lines.
 * Rejects if debit != credit or if active journal already exists for sourceId.
 */
export async function createJournalEntry(options: CreateJournalEntryOptions) {
  const { entryDate, sourceType, sourceId, description, lines } = options;
  const db = options.tx ?? prisma;

  if (lines.length < 2) {
    throw new Error("Jurnal harus memiliki minimal 2 baris (Debet dan Kredit).");
  }

  // 1. Validate Double-Entry Balance
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    totalDebit += Number(line.debit);
    totalCredit += Number(line.credit);
  }

  // Round to 2 decimal places to avoid floating point precision issues
  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;

  if (roundedDebit !== roundedCredit) {
    throw new Error(
      `Integritas jurnal gagal: Total Debet (${roundedDebit}) tidak sama dengan Total Kredit (${roundedCredit}).`
    );
  }

  // 2. Check Idempotency (prevent duplicate journal creation for same source)
  const existingActiveJournal = await db.journalEntry.findFirst({
    where: {
      sourceType,
      sourceId,
      status: TransactionStatus.POSTED,
    },
  });

  if (existingActiveJournal) {
    throw new Error(
      `Jurnal aktif untuk ${sourceType} dengan referensi ID ${sourceId} sudah ada (${existingActiveJournal.journalNumber}).`
    );
  }

  // 3. Generate sequential journal number if not provided
  const journalNumber =
    options.journalNumber ??
    `JRN-${sourceType.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 4. Insert Journal Entry & Lines
  const journal = await db.journalEntry.create({
    data: {
      journalNumber,
      entryDate,
      sourceType,
      sourceId,
      description,
      status: TransactionStatus.POSTED,
      dataScope: options.dataScope ?? DataScope.REAL,
      lines: {
        create: lines.map((l) => ({
          coaId: l.coaId,
          projectId: l.projectId ?? null,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo ?? null,
        })),
      },
    },
    include: {
      lines: {
        include: {
          coa: true,
        },
      },
    },
  });

  return journal;
}

/**
 * Resolves appropriate COA account for CashAccount.
 * Defaults:
 *   CASH -> COA 1101 (Kas Kecil & Kas Lapangan)
 *   BANK -> COA 1102 (Rekening Operasional Bank)
 */
export async function getCashAccountCoaId(
  accountType: AccountType,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx ?? prisma;
  const code = accountType === AccountType.CASH ? "1101" : "1102";

  const coa = await db.coaAccount.findUnique({
    where: { accountCode: code },
  });

  if (!coa) {
    throw new Error(`COA untuk akun tipe ${accountType} (${code}) tidak ditemukan dalam master.`);
  }

  return coa.id;
}

/**
 * Resolves mapped Debit COA for an expense category.
 */
export async function getCategoryDebitCoaId(
  categoryId: string,
  subCategoryId?: string | null,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx ?? prisma;

  // Try specific subcategory mapping first if provided
  if (subCategoryId) {
    const specificMapping = await db.categoryCoaMapping.findFirst({
      where: {
        categoryId,
        subCategoryId,
        isActive: true,
      },
    });
    if (specificMapping) return specificMapping.debitCoaId;
  }

  // Fallback to parent category mapping
  const generalMapping = await db.categoryCoaMapping.findFirst({
    where: {
      categoryId,
      subCategoryId: null,
      isActive: true,
    },
  });

  if (generalMapping) return generalMapping.debitCoaId;

  // If not mapped, fallback to general project expense COA 5105 or 6101
  const defaultCoa = await db.coaAccount.findFirst({
    where: { accountCode: "5105" },
  });

  if (!defaultCoa) {
    throw new Error(`Pemetaan COA untuk kategori ID ${categoryId} tidak ditemukan.`);
  }

  return defaultCoa.id;
}

/**
 * Voids an active journal entry.
 */
export async function voidJournalEntry(
  sourceType: JournalSourceType,
  sourceId: string,
  reason: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;

  const journal = await db.journalEntry.findFirst({
    where: {
      sourceType,
      sourceId,
      status: TransactionStatus.POSTED,
    },
  });

  if (!journal) return null;

  return await db.journalEntry.update({
    where: { id: journal.id },
    data: {
      status: TransactionStatus.VOID,
      voidedAt: new Date(),
      voidReason: reason,
    },
  });
}
