import { prisma } from "../db/prisma";
import { CashType, Prisma } from "@prisma/client";

export interface GenerateNoKasOptions {
  prefix: "KU" | "KT" | CashType;
  year?: number;
  tx?: Prisma.TransactionClient;
}

/**
 * Generates an atomic, unique sequential No Kas (KU.26.xxx or KT.26.xxx).
 * Thread-safe using PostgreSQL atomic UPSERT with row-locking.
 */
export async function generateNextNoKas(options: GenerateNoKasOptions): Promise<string> {
  const prefix = options.prefix;
  const currentYear = options.year ?? new Date().getFullYear();
  const db = options.tx ?? prisma;

  // Atomic increment with ON CONFLICT DO UPDATE
  const result = await db.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "cash_sequences" ("prefix", "year", "lastNumber")
    VALUES (${prefix}, ${currentYear}, 1)
    ON CONFLICT ("prefix", "year")
    DO UPDATE SET "lastNumber" = "cash_sequences"."lastNumber" + 1
    RETURNING "lastNumber"
  `;

  if (!result || result.length === 0) {
    throw new Error(`Failed to generate sequential No Kas for prefix ${prefix} and year ${currentYear}`);
  }

  const lastNum = result[0].lastNumber;
  const year2Digits = String(currentYear).slice(-2);
  const paddedNum = String(lastNum).padStart(3, "0");

  return `${prefix}.${year2Digits}.${paddedNum}`;
}

/**
 * Validates whether a given string adheres to No Kas format
 */
export function isValidNoKasFormat(noKas: string): boolean {
  return /^(KU|KT)\.[0-9]{2}\.[0-9]{3,}$/.test(noKas);
}
