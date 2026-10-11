import { z } from "zod";

export const projectTypeEnum = z.enum(["KONTRAKTOR", "KONSULTAN", "INTERNAL"]);

export const createProjectBudgetSchema = z.object({
  projectId: z.string().uuid("ID Proyek tidak valid"),
  title: z
    .string({ required_error: "Judul Anggaran (RAP) wajib diisi" })
    .trim()
    .min(1, "Judul Anggaran (RAP) wajib diisi")
    .max(150, "Judul Anggaran (RAP) maksimal 150 karakter"),
  notes: z
    .string()
    .trim()
    .max(2000, "Catatan maksimal 2000 karakter")
    .nullable()
    .optional(),
  items: z
    .array(
      z.object({
        itemCode: z.string().trim().max(50).nullable().optional(),
        description: z.string().trim().min(1, "Uraian pekerjaan wajib diisi").max(255),
        category: z.string().trim().max(100).nullable().optional(),
        volume: z.number().positive("Volume harus lebih besar dari 0"),
        unit: z.string().trim().min(1).max(30).default("ls"),
        unitPrice: z.number().min(0, "Harga satuan tidak boleh negatif"),
      })
    )
    .optional(),
});

export type CreateProjectBudgetInput = z.infer<typeof createProjectBudgetSchema>;

export const addBudgetItemSchema = z.object({
  budgetId: z.string().uuid("ID Versi Anggaran (RAP) tidak valid"),
  projectId: z.string().uuid("ID Proyek tidak valid").optional(),
  itemCode: z.string().trim().max(50, "Kode item maksimal 50 karakter").nullable().optional(),
  description: z
    .string({ required_error: "Uraian pekerjaan / material wajib diisi" })
    .trim()
    .min(1, "Uraian pekerjaan / material wajib diisi")
    .max(255, "Uraian pekerjaan / material maksimal 255 karakter"),
  category: z.string().trim().max(100, "Kategori maksimal 100 karakter").nullable().optional(),
  volume: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return NaN;
    const num = Number(val);
    return isNaN(num) ? NaN : num;
  }, z.number({ invalid_type_error: "Volume harus berupa angka valid" })
      .positive("Volume harus berupa angka lebih besar dari 0")
      .refine((n) => isFinite(n), "Volume tidak boleh bernilai Infinity")),
  unit: z
    .string({ required_error: "Satuan wajib diisi" })
    .trim()
    .min(1, "Satuan wajib diisi")
    .max(30, "Satuan maksimal 30 karakter")
    .default("ls"),
  unitPrice: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return NaN;
    const num = Number(val);
    return isNaN(num) ? NaN : num;
  }, z.number({ invalid_type_error: "Harga satuan harus berupa angka valid" })
      .min(0, "Harga satuan tidak boleh bernilai negatif")
      .refine((n) => isFinite(n), "Harga satuan tidak boleh bernilai Infinity")),
});

export type AddBudgetItemInput = z.infer<typeof addBudgetItemSchema>;

export const updateProjectContractSchema = z.object({
  id: z.string().uuid("ID Proyek tidak valid"),
  clientName: z.string().trim().max(150, "Nama klien maksimal 150 karakter").nullable().optional(),
  projectType: projectTypeEnum.default("KONTRAKTOR"),
  contractValue: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }, z.number().min(0, "Nilai kontrak tidak boleh negatif").nullable().optional()),
  targetStartDate: z.preprocess((val) => {
    if (!val || val === "") return null;
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? null : d;
  }, z.date().nullable().optional()),
  targetEndDate: z.preprocess((val) => {
    if (!val || val === "") return null;
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? null : d;
  }, z.date().nullable().optional()),
});

export type UpdateProjectContractInput = z.infer<typeof updateProjectContractSchema>;

export const masterProjectSchema = z.object({
  code: z
    .string({ required_error: "Kode proyek wajib diisi" })
    .trim()
    .min(1, "Kode proyek wajib diisi")
    .max(30, "Kode proyek maksimal 30 karakter")
    .transform((c) => c.toUpperCase()),
  name: z
    .string({ required_error: "Nama proyek wajib diisi" })
    .trim()
    .min(1, "Nama proyek wajib diisi")
    .max(150, "Nama proyek maksimal 150 karakter"),
  description: z.string().trim().max(1000).nullable().optional(),
  clientName: z.string().trim().max(150).nullable().optional(),
  projectType: projectTypeEnum.default("KONTRAKTOR"),
  contractValue: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }, z.number().min(0, "Nilai kontrak tidak boleh negatif").nullable().optional()),
  targetStartDate: z.preprocess((val) => {
    if (!val || val === "") return null;
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? null : d;
  }, z.date().nullable().optional()),
  targetEndDate: z.preprocess((val) => {
    if (!val || val === "") return null;
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? null : d;
  }, z.date().nullable().optional()),
});

export type MasterProjectInput = z.infer<typeof masterProjectSchema>;
