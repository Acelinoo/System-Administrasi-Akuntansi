"use server";

import { revalidatePath } from "next/cache";
import {
  createProjectBudget,
  addBudgetItem,
  deleteBudgetItem,
  createProjectTermin,
  recordTerminPayment,
  createProjectProgressLog,
  createExpenseItemDetail,
  createVendorContract,
} from "@/lib/finance/project-360.service";
import { prisma } from "@/lib/db/prisma";

export async function createProjectBudgetAction(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const title = (formData.get("title") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  const itemsJson = formData.get("items") as string;

  if (!projectId || !title) {
    return { error: "ID Proyek dan Judul Anggaran (RAP) wajib diisi." };
  }

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
  const projectId = formData.get("projectId") as string;
  const budgetId = formData.get("budgetId") as string;
  const itemCode = (formData.get("itemCode") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim();
  const category = (formData.get("category") as string)?.trim() || null;
  const volumeRaw = formData.get("volume") as string;
  const unit = (formData.get("unit") as string)?.trim() || "ls";
  const unitPriceRaw = formData.get("unitPrice") as string;

  if (!budgetId || !description) {
    return { error: "Uraian pekerjaan/barang wajib diisi." };
  }

  const volume = parseFloat(volumeRaw) || 1;
  const unitPrice = parseFloat(unitPriceRaw) || 0;

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
  try {
    await deleteBudgetItem(itemId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/reports/projects`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus item anggaran." };
  }
}

export async function createProjectTerminAction(formData: FormData) {
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

  try {
    const result = await recordTerminPayment({
      terminId,
      destinationAccountId,
      amount,
      receivedDate,
      referenceNo,
      notes,
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
  const projectId = formData.get("projectId") as string;
  const accItemId = formData.get("accItemId") as string;
  const itemName = (formData.get("itemName") as string)?.trim();
  const quantityRaw = formData.get("quantity") as string;
  const unit = (formData.get("unit") as string)?.trim() || "bh";
  const unitPriceRaw = formData.get("unitPrice") as string;
  const vendorId = (formData.get("vendorId") as string)?.trim() || null;
  const referenceNo = (formData.get("referenceNo") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!accItemId || !itemName) {
    return { error: "Item pengeluaran dan nama barang/material wajib diisi." };
  }

  const quantity = parseFloat(quantityRaw) || 1;
  const unitPrice = parseFloat(unitPriceRaw) || 0;

  try {
    const detail = await createExpenseItemDetail({
      accItemId,
      itemName,
      quantity,
      unit,
      unitPrice,
      vendorId: vendorId && vendorId !== "NONE" ? vendorId : null,
      referenceNo,
      notes,
    });

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath(`/acc/${accItemId}`);
    return { success: true, detailId: detail.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal menambah rincian barang/material." };
  }
}

export async function createVendorContractAction(formData: FormData) {
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  const vendorId = formData.get("vendorId") as string;
  const contractNumber = (formData.get("contractNumber") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const contractValueRaw = formData.get("contractValue") as string;
  const startDateRaw = formData.get("startDate") as string;
  const endDateRaw = formData.get("endDate") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!vendorId || !contractNumber || !title || !contractValueRaw) {
    return { error: "Vendor, Nomor Kontrak, Judul, dan Nilai Kontrak wajib diisi." };
  }

  const contractValue = parseFloat(contractValueRaw);
  if (isNaN(contractValue) || contractValue <= 0) {
    return { error: "Nilai kontrak vendor harus lebih besar dari 0." };
  }

  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

  try {
    const contract = await createVendorContract({
      vendorId,
      projectId: projectId && projectId !== "NONE" ? projectId : null,
      contractNumber,
      title,
      contractValue,
      startDate,
      endDate,
      notes,
    });

    if (projectId && projectId !== "NONE") {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath(`/master/vendors`);
    return { success: true, contractId: contract.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Gagal membuat kontrak vendor." };
  }
}

export async function updateProjectContractDetailsAction(formData: FormData) {
  const id = formData.get("id") as string;
  const clientName = (formData.get("clientName") as string)?.trim() || null;
  const projectType = (formData.get("projectType") as string)?.trim() || "KONTRAKTOR";
  const contractValueRaw = (formData.get("contractValue") as string)?.trim();
  const contractValue = contractValueRaw ? parseFloat(contractValueRaw) : null;
  const targetStartDateRaw = (formData.get("targetStartDate") as string)?.trim();
  const targetStartDate = targetStartDateRaw ? new Date(targetStartDateRaw) : null;
  const targetEndDateRaw = (formData.get("targetEndDate") as string)?.trim();
  const targetEndDate = targetEndDateRaw ? new Date(targetEndDateRaw) : null;

  if (!id) return { error: "ID Proyek tidak valid." };

  try {
    await prisma.project.update({
      where: { id },
      data: {
        clientName,
        projectType,
        contractValue: contractValue !== null && !isNaN(contractValue) ? contractValue : null,
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
