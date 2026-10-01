"use server";

import { revalidatePath } from "next/cache";
import {
  parseAndValidateExcel,
  executeControlledImport,
  ExecuteImportPayload,
  ImportPreviewResult,
} from "../../lib/finance/import.service";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function previewExcelImportAction(
  formData: FormData
): Promise<ActionResult<ImportPreviewResult>> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "Silakan pilih file Excel (.xlsx / .xls) untuk diunggah." };
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return {
        success: false,
        error: "Format file tidak didukung. Harap unggah file spreadsheet Excel (.xlsx atau .xls).",
      };
    }

    // Size limit check (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "Ukuran file terlalu besar (maksimal 10MB)." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preview = await parseAndValidateExcel(buffer, file.name);

    return {
      success: true,
      data: preview,
    };
  } catch (error) {
    console.error("Preview Excel import error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memproses file Excel.",
    };
  }
}

export async function confirmExcelImportAction(
  payload: ExecuteImportPayload
): Promise<ActionResult<{ batchId: string; batchCode: string; importedCount: number; totalApprovedAmount: number }>> {
  try {
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: "Tidak ada baris data valid yang dapat diimpor." };
    }

    const result = await executeControlledImport(payload);

    revalidatePath("/acc");
    revalidatePath("/dashboard");
    revalidatePath("/reports/acc");
    revalidatePath("/reports/realization");
    revalidatePath("/reports/projects");
    revalidatePath("/reports/pic");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Confirm Excel import error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menyimpan data impor ke database.",
    };
  }
}
