"use server";

import { revalidatePath } from "next/cache";
import {
  createProjectBudget,
  addBudgetItem,
  deleteBudgetItem,
  deleteProjectBudget,
  createProjectTermin,
  recordTerminPayment,
  createProjectProgressLog,
  createExpenseItemDetail,
  deleteExpenseItemDetail,
  createVendorContract,
  deleteVendorContract,
} from "@/lib/finance/project-360.service";
import { prisma } from "@/lib/db/prisma";
import { DataScope } from "@prisma/client";
import {
  createProjectBudgetSchema,
  addBudgetItemSchema,
  updateProjectContractSchema,
} from "@/lib/validation/project-budget.schema";
import {
  createExpenseItemDetailSchema,
  createVendorContractSchema,
} from "@/lib/validation/vendor-expense.schema";
import { requireAuth, requireAdmin } from "@/lib/auth/auth.service";

export async function createProjectBudgetAction(formData: FormData) {
  await requireAdmin();
  const parsed = createProjectBudgetSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Input anggaran tidak valid." };
  }

  const { projectId, title, notes } = parsed.data;
  const itemsJson = formData.get("items") as string;

  let items = [];
  if (itemsJson) {
    try {
      items = JSON.parse(itemsJson);
    } catch {
      return { error: "Format item anggaran tidak valid." };
    }
  }

  try {
    const budget = await createProjectBudget({
      projectId,
      title,
      notes,
      items,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/reports/projects`);
    return { success: true, budgetId: budget.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal membuat anggaran RAP." };
  }
}

export async function addBudgetItemAction(formData: FormData) {
  await requireAdmin();
  const parsed = addBudgetItemSchema.safeParse({
    projectId: formData.get("projectId") || undefined,
    budgetId: formData.get("budgetId"),
    itemCode: formData.get("itemCode") || null,
    description: formData.get("description"),
    category: formData.get("category") || null,
    volume: formData.get("volume"),
    unit: formData.get("unit"),
    unitPrice: formData.get("unitPrice"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Input item anggaran tidak valid." };
  }

  const { budgetId, projectId, itemCode, description, category, volume, unit, unitPrice } = parsed.data;

  try {
    const item = await addBudgetItem({
      budgetId,
      itemCode,
      description,
      category,
      volume,
      unit,
      unitPrice,
    });

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath(`/reports/projects`);
    return { success: true, itemId: item.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah rincian anggaran." };
  }
}

export async function deleteBudgetItemAction(itemId: string, projectId: string) {
  await requireAdmin();
  try {
    await deleteBudgetItem(itemId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/reports/projects`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus item anggaran." };
  }
}

export async function deleteProjectBudgetAction(budgetId: string, projectId: string) {
  await requireAdmin();
  if (!budgetId || !projectId) {
    return { error: "ID Anggaran dan ID Proyek wajib diisi." };
  }

  try {
    await deleteProjectBudget(budgetId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/reports/projects`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus versi anggaran." };
  }
}

export async function createProjectTerminAction(formData: FormData) {
  await requireAuth();
  const projectId = formData.get("projectId") as string;
  const terminNumberRaw = formData.get("terminNumber") as string;
  const name = (formData.get("name") as string)?.trim();
  const plannedAmountRaw = formData.get("plannedAmount") as string;
  const invoiceNumber = (formData.get("invoiceNumber") as string)?.trim() || null;
  const invoiceDateRaw = formData.get("invoiceDate") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!projectId || !name || !plannedAmountRaw) {
    return { error: "Proyek, Nama Termin, dan Rencana Nominal wajib diisi." };
  }

  const terminNumber = parseInt(terminNumberRaw, 10) || 1;
  const plannedAmount = parseFloat(plannedAmountRaw);
  if (isNaN(plannedAmount) || plannedAmount <= 0) {
    return { error: "Rencana nominal termin harus lebih besar dari 0." };
  }

  const invoiceDate = invoiceDateRaw ? new Date(invoiceDateRaw) : null;

  try {
    const termin = await createProjectTermin({
      projectId,
      terminNumber,
      name,
      plannedAmount,
      invoiceNumber,
      invoiceDate,
      notes,
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, terminId: termin.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal membuat termin penagihan." };
  }
}

export async function recordTerminPaymentAction(formData: FormData) {
  await requireAuth();
  const projectId = formData.get("projectId") as string;
  const terminId = formData.get("terminId") as string;
  const destinationAccountId = formData.get("destinationAccountId") as string;
  const amountRaw = formData.get("amount") as string;
  const receivedDateRaw = formData.get("receivedDate") as string;
  const referenceNo = (formData.get("referenceNo") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!terminId || !destinationAccountId || !amountRaw || !receivedDateRaw) {
    return { error: "Akun penerima, nominal, dan tanggal terima wajib diisi." };
  }

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    return { error: "Nominal pembayaran termin harus lebih besar dari 0." };
  }

  const receivedDate = new Date(receivedDateRaw);
  const dataScopeRaw = formData.get("dataScope") as string | null;
  const dataScope: DataScope | undefined =
    dataScopeRaw === "TEST" ? DataScope.TEST : dataScopeRaw === "REAL" ? DataScope.REAL : undefined;

  try {
    const result = await recordTerminPayment({
      terminId,
      destinationAccountId,
      amount,
      receivedDate,
      referenceNo,
      notes,
      dataScope,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/inflows");
    revalidatePath("/journals");
    revalidatePath("/");
    return { success: true, inflowId: result.inflow.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mencatat penerimaan termin." };
  }
}

export async function createProjectProgressLogAction(formData: FormData) {
  await requireAuth();
  const projectId = formData.get("projectId") as string;
  const logDateRaw = formData.get("logDate") as string;
  const physicalProgressPctRaw = formData.get("physicalProgressPct") as string;
  const volumeDescription = (formData.get("volumeDescription") as string)?.trim() || null;
  const sourceInfo = (formData.get("sourceInfo") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!projectId || !logDateRaw || !physicalProgressPctRaw) {
    return { error: "Tanggal opname dan persentase progres fisik wajib diisi." };
  }

  const physicalProgressPct = parseFloat(physicalProgressPctRaw);
  if (isNaN(physicalProgressPct) || physicalProgressPct < 0 || physicalProgressPct > 100) {
    return { error: "Persentase progres fisik harus berupa angka antara 0% s.d. 100%." };
  }

  const logDate = new Date(logDateRaw);

  try {
    const log = await createProjectProgressLog({
      projectId,
      logDate,
      physicalProgressPct,
      volumeDescription,
      sourceInfo,
      notes,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/reports/projects`);
    revalidatePath(`/`);
    return { success: true, logId: log.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal mencatat log progres fisik." };
  }
}

export async function createExpenseItemDetailAction(formData: FormData) {
  await requireAuth();
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  const accItemId = (formData.get("accItemId") as string)?.trim();
  const itemName = (formData.get("itemName") as string)?.trim();
  const quantityRaw = formData.get("quantity") as string;
  const unit = (formData.get("unit") as string)?.trim() || "bh";
  const unitPriceRaw = formData.get("unitPrice") as string;
  const vendorIdRaw = (formData.get("vendorId") as string)?.trim();
  const vendorId = vendorIdRaw && vendorIdRaw !== "NONE" ? vendorIdRaw : null;
  const referenceNo = (formData.get("referenceNo") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const quantity = parseFloat(quantityRaw);
  const unitPrice = parseFloat(unitPriceRaw);

  const parsed = createExpenseItemDetailSchema.safeParse({
    accItemId,
    itemName,
    quantity,
    unit,
    unitPrice,
    vendorId,
    referenceNo,
    notes,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Data rincian material tidak valid." };
  }

  try {
    const detail = await createExpenseItemDetail(parsed.data);

    if (projectId && projectId !== "NONE") {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath(`/acc/${accItemId}`);
    return { success: true, detailId: detail.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah rincian barang/material." };
  }
}

export async function deleteExpenseItemDetailAction(formData: FormData) {
  await requireAdmin();
  const detailId = (formData.get("detailId") as string)?.trim();
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  const accItemId = (formData.get("accItemId") as string)?.trim() || null;

  if (!detailId) {
    return { error: "ID rincian barang wajib disertakan." };
  }

  try {
    await deleteExpenseItemDetail(detailId);
    if (projectId && projectId !== "NONE") {
      revalidatePath(`/projects/${projectId}`);
    }
    if (accItemId) {
      revalidatePath(`/acc/${accItemId}`);
    }
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus rincian material." };
  }
}

export async function createVendorContractAction(formData: FormData) {
  await requireAdmin();
  const projectIdRaw = (formData.get("projectId") as string)?.trim();
  const projectId = projectIdRaw && projectIdRaw !== "NONE" ? projectIdRaw : null;
  const vendorId = (formData.get("vendorId") as string)?.trim();
  const contractNumber = (formData.get("contractNumber") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const contractValueRaw = formData.get("contractValue") as string;
  const startDateRaw = (formData.get("startDate") as string)?.trim() || null;
  const endDateRaw = (formData.get("endDate") as string)?.trim() || null;
  const status = (formData.get("status") as string)?.trim() || "ACTIVE";
  const notes = (formData.get("notes") as string)?.trim() || null;

  const contractValue = parseFloat(contractValueRaw);

  const parsed = createVendorContractSchema.safeParse({
    vendorId,
    projectId,
    contractNumber,
    title,
    contractValue,
    startDate: startDateRaw ? new Date(startDateRaw) : null,
    endDate: endDateRaw ? new Date(endDateRaw) : null,
    status,
    notes,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Data kontrak vendor tidak valid." };
  }

  try {
    const contract = await createVendorContract(parsed.data);

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath(`/master/vendors`);
    return { success: true, contractId: contract.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal membuat kontrak vendor." };
  }
}

export async function deleteVendorContractAction(formData: FormData) {
  await requireAdmin();
  const contractId = (formData.get("contractId") as string)?.trim();
  const projectId = (formData.get("projectId") as string)?.trim() || null;

  if (!contractId) {
    return { error: "ID kontrak vendor wajib disertakan." };
  }

  try {
    await deleteVendorContract(contractId);
    if (projectId && projectId !== "NONE") {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath(`/master/vendors`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus kontrak vendor." };
  }
}

export async function updateProjectContractDetailsAction(formData: FormData) {
  await requireAdmin();
  const parsed = updateProjectContractSchema.safeParse({
    id: formData.get("id"),
    clientName: formData.get("clientName") || null,
    projectType: formData.get("projectType") || "KONTRAKTOR",
    contractValue: formData.get("contractValue"),
    targetStartDate: formData.get("targetStartDate"),
    targetEndDate: formData.get("targetEndDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Data kontrak tidak valid." };
  }

  const { id, clientName, projectType, contractValue, targetStartDate, targetEndDate } = parsed.data;

  try {
    await prisma.project.update({
      where: { id },
      data: {
        clientName,
        projectType,
        contractValue,
        targetStartDate,
        targetEndDate,
      },
    });

    revalidatePath(`/projects/${id}`);
    revalidatePath(`/master/projects`);
    revalidatePath(`/reports/projects`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal memperbarui data kontrak proyek." };
  }
}
