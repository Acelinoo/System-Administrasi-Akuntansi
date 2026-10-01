import { z } from "zod";
import { DataScope } from "@prisma/client";

export const createFundInflowSchema = z.object({
  inflowNumber: z.string().trim().min(3).optional(), // auto generated if omitted
  inflowDate: z.coerce.date(),
  destinationAccountId: z.string().uuid("Akun kas/bank tujuan harus valid"),
  amount: z.number().positive("Nominal penerimaan dana harus lebih besar dari 0"),
  sourceInfo: z.string().trim().min(3, "Keterangan sumber dana wajib diisi"),
  referenceNo: z.string().trim().nullable().optional(),
  createdById: z.string().uuid().optional(),
  dataScope: z.nativeEnum(DataScope).optional(),
});

export type CreateFundInflowInput = z.infer<typeof createFundInflowSchema>;
