import { z } from "zod";
import { PaymentMethod, DataScope } from "@prisma/client";

export const disbursementItemInputSchema = z.object({
  accItemId: z.string().uuid("ID item ACC harus berupa UUID valid"),
  realizedAmount: z.number().positive("Nominal pencairan harus lebih besar dari 0"),
});

export const createDisbursementSchema = z.object({
  disbursementNumber: z.string().trim().min(3).optional(), // auto generated if omitted
  disbursementDate: z.coerce.date(),
  cashAccountId: z.string().uuid("Akun kas/bank pembayar harus berupa UUID valid"),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: "Metode pembayaran harus CASH, TRANSFER, atau GIRO" }),
  }),
  totalRealizedAmount: z.number().positive("Total pencairan harus lebih besar dari 0"),
  notes: z.string().trim().nullable().optional(),
  createdById: z.string().uuid().optional(),
  dataScope: z.nativeEnum(DataScope).optional(),
  items: z.array(disbursementItemInputSchema).min(1, "Minimal harus mencairkan 1 item pengeluaran"),
});

export type DisbursementItemInput = z.infer<typeof disbursementItemInputSchema>;
export type CreateDisbursementInput = z.infer<typeof createDisbursementSchema>;
