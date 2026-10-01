"use server";

import { prisma } from "@/lib/db/prisma";
import { createFundInflow, voidFundInflow } from "@/lib/finance/inflow.service";
import { TransactionStatus, DataScope } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getInflowList(dataScope: DataScope | "ALL" = DataScope.REAL) {
  const where = dataScope === "ALL" ? {} : { dataScope };
  return prisma.fundInflow.findMany({
    where,
    orderBy: { inflowDate: "desc" },
    include: {
      destinationAccount: {
        select: { accountCode: true, accountName: true, accountType: true },
      },
    },
  });
}

export async function createInflowAction(formData: FormData) {
  const inflowDate = formData.get("inflowDate") as string;
  const destinationAccountId = formData.get("destinationAccountId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const sourceInfo = formData.get("sourceInfo") as string;
  const referenceNo = formData.get("referenceNo") as string | null;

  try {
    const result = await createFundInflow({
      inflowDate: new Date(inflowDate),
      destinationAccountId,
      amount,
      sourceInfo,
      referenceNo: referenceNo || null,
    });

    revalidatePath("/inflows");
    revalidatePath("/");
    return { success: true, inflowId: result.id, inflowNumber: result.inflowNumber };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    return { error: message };
  }
}

export async function voidInflowAction(formData: FormData) {
  const inflowId = formData.get("inflowId") as string;
  const voidReason = formData.get("voidReason") as string;

  try {
    await voidFundInflow(inflowId, voidReason);
    revalidatePath("/inflows");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    return { error: message };
  }
}
