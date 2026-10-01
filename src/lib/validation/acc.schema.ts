import { z } from "zod";
import { CashType } from "@prisma/client";

export const accExpenseItemInputSchema = z.object({
  noKas: z
    .string()
    .trim()
    .regex(/^(KU|KT)\.[0-9]{2}\.[0-9]{3,}$/, "Format No Kas harus KU.YY.xxx atau KT.YY.xxx")
    .optional(), // If omitted, generator will produce one based on cashType
  cashType: z.nativeEnum(CashType, {
    errorMap: () => ({ message: "cashType harus KU atau KT" }),
  }),
  projectId: z.string().uuid("Project ID harus berupa UUID valid"),
  subUnitId: z.string().uuid("Sub Unit ID harus berupa UUID valid").nullable().optional(),
  categoryId: z.string().uuid("Category ID harus berupa UUID valid"),
  subCategoryId: z.string().uuid("Sub Category ID harus berupa UUID valid").nullable().optional(),
  picId: z.string().uuid("PIC ID harus berupa UUID valid"),
  description: z.string().trim().min(3, "Uraian kebutuhan minimal 3 karakter"),
  requestedAmount: z.number().positive().nullable().optional(),
  approvedAmount: z.number().positive("Nominal ACC harus lebih besar dari 0"),
  notes: z.string().trim().nullable().optional(),
});

export const createSubmissionBatchSchema = z.object({
  batchCode: z.string().trim().min(3, "Batch code minimal 3 karakter"),
  accDate: z.coerce.date(),
  approvedByName: z.string().trim().min(2, "Nama atasan peng-ACC wajib diisi").default("Pa Giri"),
  notes: z.string().trim().nullable().optional(),
  createdById: z.string().uuid().optional(),
  items: z.array(accExpenseItemInputSchema).min(1, "Minimal harus ada 1 item ACC dalam batch"),
});

export type AccExpenseItemInput = z.infer<typeof accExpenseItemInputSchema>;
export type CreateSubmissionBatchInput = z.infer<typeof createSubmissionBatchSchema>;
