"use server";

import { prisma } from "@/lib/db/prisma";
import { DataScope } from "@prisma/client";

export async function getJournalList(dataScope: DataScope | "ALL" = DataScope.REAL, projectId?: string) {
  const where: Record<string, unknown> = dataScope === "ALL" ? {} : { dataScope };
  if (projectId && projectId !== "ALL") {
    where.lines = { some: { projectId } };
  }
  return prisma.journalEntry.findMany({
    where,
    orderBy: { entryDate: "desc" },
    include: {
      lines: {
        include: {
          coa: { select: { accountCode: true, accountName: true } },
          project: { select: { code: true, name: true } },
        },
      },
    },
  });
}

export async function getJournalDetail(id: string) {
  return prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          coa: true,
          project: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
