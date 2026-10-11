import { z } from "zod";
import { VendorType } from "@prisma/client";

export const createExpenseItemDetailSchema = z.object({
  accItemId: z.string().uuid("ID item ACC harus berupa UUID valid"),
  itemName: z.string().trim().min(2, "Nama barang/material minimal 2 karakter"),
  quantity: z.number().positive("Kuantitas barang harus lebih besar dari 0"),
  unit: z.string().trim().min(1, "Satuan barang wajib diisi").default("bh"),
  unitPrice: z.number().min(0, "Harga satuan tidak boleh negatif"),
  vendorId: z.string().uuid("ID vendor harus berupa UUID valid").nullable().optional(),
  referenceNo: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const createVendorContractSchema = z
  .object({
    vendorId: z.string().uuid("Vendor rekanan harus dipilih"),
    projectId: z.string().uuid("Project ID harus berupa UUID valid").nullable().optional(),
    contractNumber: z.string().trim().min(2, "Nomor kontrak minimal 2 karakter"),
    title: z.string().trim().min(3, "Judul kontrak minimal 3 karakter"),
    contractValue: z.number().positive("Nilai kontrak harus lebih besar dari 0"),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    status: z.string().trim().default("ACTIVE"),
    notes: z.string().trim().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: "Tanggal mulai kontrak tidak boleh melebihi tanggal selesai",
      path: ["endDate"],
    }
  );

export const createVendorSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .nullable()
    .optional(),
  name: z.string().trim().min(2, "Nama vendor/rekanan minimal 2 karakter"),
  type: z.nativeEnum(VendorType, {
    errorMap: () => ({ message: "Tipe vendor harus SUPPLIER, SUBCONTRACTOR, atau SERVICE" }),
  }),
  phone: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const updateVendorSchema = createVendorSchema.extend({
  id: z.string().uuid("ID vendor harus berupa UUID valid"),
});

export type CreateExpenseItemDetailInput = z.infer<typeof createExpenseItemDetailSchema>;
export type CreateVendorContractInput = z.infer<typeof createVendorContractSchema>;
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
