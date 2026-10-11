"use server";

import { prisma } from "@/lib/db/prisma";
import { createFundInflow, voidFundInflow } from "@/lib/finance/inflow.service";
import { requireAuth, requireAdmin } from "@/lib/auth/auth.service";
import { TransactionStatus, DataScope } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { sanitizeErrorMessage } from "@/lib/utils/error";

export async function getInflowList(dataScope: DataScope | "ALL" = DataScope.REAL) {
  await requireAuth();
  const where = dataScope === "ALL" ? {} : { dataScope };
  return prisma.fundInflow.findMany({
    where,
    orderBy: { inflowDate: "desc" },
    include: {
      destinationAccount: {
        select: { accountCode: true, accountName: true, accountType: true },
      },
      project: {
        select: { id: true, code: true, name: true },
      },
    },
  });
}

export async function createInflowAction(formData: FormData) {
  const user = await requireAuth();

  const inflowDate = formData.get("inflowDate") as string;
  const destinationAccountId = formData.get("destinationAccountId") as string;
  const projectIdRaw = (formData.get("projectId") as string)?.trim();
  const amount = parseFloat(formData.get("amount") as string);
  const sourceInfo = formData.get("sourceInfo") as string;
  const referenceNo = formData.get("referenceNo") as string | null;

  const dataScopeRaw = formData.get("dataScope") as string | null;
  const dataScope = dataScopeRaw === "TEST" ? DataScope.TEST : dataScopeRaw === "REAL" ? DataScope.REAL : undefined;

  try {
    const result = await createFundInflow({
      inflowDate: new Date(inflowDate),
      destinationAccountId,
      projectId: projectIdRaw ? projectIdRaw : undefined,
      amount,
      sourceInfo,
      referenceNo: referenceNo || null,
      createdById: user.id,
      dataScope,
    });

    revalidatePath("/inflows");
    revalidatePath("/");
    return { success: true, inflowId: result.id, inflowNumber: result.inflowNumber };
  } catch (err: unknown) {
    return { error: sanitizeErrorMessage(err, "Terjadi kesalahan saat mencatat penerimaan dana.") };
  }
}

export async function voidInflowAction(formData: FormData) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    return { error: sanitizeErrorMessage(err, "Akses ditolak: Operasi ini memerlukan hak Administrator.") };
  }

  const inflowId = formData.get("inflowId") as string;
  const voidReason = formData.get("voidReason") as string;
  const dataScopeRaw = formData.get("dataScope") as string | null;
  const expectedScope = dataScopeRaw === "TEST" ? DataScope.TEST : dataScopeRaw === "REAL" ? DataScope.REAL : undefined;

  try {
    await voidFundInflow(inflowId, voidReason, undefined, expectedScope);
    revalidatePath("/inflows");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    return { error: sanitizeErrorMessage(err, "Terjadi kesalahan saat membatalkan penerimaan dana.") };
  }
}
