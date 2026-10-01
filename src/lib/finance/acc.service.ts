import { prisma } from "../db/prisma";
import { AccStatus, CashType, Prisma } from "@prisma/client";
import { CreateSubmissionBatchInput, createSubmissionBatchSchema } from "../validation/acc.schema";
import { generateNextNoKas, isValidNoKasFormat } from "./no-kas";

export async function createSubmissionBatch(
  rawInput: CreateSubmissionBatchInput,
  txClient?: Prisma.TransactionClient
) {
  // 1. Zod Validation
  const validated = createSubmissionBatchSchema.parse(rawInput);

  const runInTx = async (tx: Prisma.TransactionClient) => {
    // 2. Validate Batch uniqueness
    const existingBatch = await tx.submissionBatch.findUnique({
      where: { batchCode: validated.batchCode },
    });
    if (existingBatch) {
      throw new Error(`Batch dengan kode '${validated.batchCode}' sudah ada.`);
    }

    // Determine dataScope based on batchCode
    const isTestBatch =
      validated.batchCode.startsWith("BATCH-TEST-") ||
      validated.batchCode.startsWith("BATCH-P7-") ||
      validated.batchCode.startsWith("BATCH-P8B-");
    const dataScope = isTestBatch ? "TEST" : "REAL";

    // 3. Create Submission Batch Header
    const batch = await tx.submissionBatch.create({
      data: {
        batchCode: validated.batchCode,
        accDate: validated.accDate,
        approvedByName: validated.approvedByName,
        notes: validated.notes ?? null,
        createdById: validated.createdById ?? null,
        administrativeSubmitter: "NISA",
        dataScope,
      },
    });

    const createdItems = [];
    const batchYear = new Date(validated.accDate).getFullYear();

    let itemIndex = 0;
    let batchNoKas: string | undefined = undefined;

    // 4. Validate & Process Each Item
    for (const item of validated.items) {
      itemIndex++;
      // Validate Project existence
      const project = await tx.project.findUnique({
        where: { id: item.projectId },
      });
      if (!project || !project.isActive) {
        throw new Error(`Proyek dengan ID ${item.projectId} tidak ditemukan atau tidak aktif.`);
      }

      // Integrity Check: Sub Unit MUST belong to the same Project
      if (item.subUnitId) {
        const subUnit = await tx.projectSubUnit.findUnique({
          where: { id: item.subUnitId },
        });
        if (!subUnit) {
          throw new Error(`Sub Unit ID ${item.subUnitId} tidak ditemukan.`);
        }
        if (subUnit.projectId !== item.projectId) {
          throw new Error(
            `Integritas proyek gagal: Sub Unit '${subUnit.name}' (${subUnit.code}) bukan bagian dari Proyek '${project.name}' (${project.code}).`
          );
        }
      }

      // Validate Category existence
      const category = await tx.expenseCategory.findUnique({
        where: { id: item.categoryId },
      });
      if (!category || !category.isActive) {
        throw new Error(`Kategori dengan ID ${item.categoryId} tidak ditemukan atau tidak aktif.`);
      }

      // Integrity Check: Sub Category MUST belong to Category
      if (item.subCategoryId) {
        const subCat = await tx.expenseSubCategory.findUnique({
          where: { id: item.subCategoryId },
        });
        if (!subCat) {
          throw new Error(`Sub Kategori ID ${item.subCategoryId} tidak ditemukan.`);
        }
        if (subCat.categoryId !== item.categoryId) {
          throw new Error(
            `Integritas kategori gagal: Sub Kategori '${subCat.name}' bukan bagian dari Kategori '${category.name}'.`
          );
        }
      }

      // Validate PIC existence
      const pic = await tx.fieldPic.findUnique({
        where: { id: item.picId },
      });
      if (!pic || !pic.isActive) {
        throw new Error(`PIC dengan ID ${item.picId} tidak ditemukan atau tidak aktif.`);
      }

      // Determine assignmentStatus
      const assignmentStatus = pic.name === "UNASSIGNED_MANDOR" ? "UNASSIGNED_MANDOR" : "ASSIGNED";

      // Resolve No Kas: atomic generation or validate manual
      let assignedNoKas = item.noKas;
      if (assignedNoKas) {
        if (!isValidNoKasFormat(assignedNoKas)) {
          throw new Error(`Format No Kas manual tidak valid: '${assignedNoKas}'. Harus format KU.YY.xxx atau KT.YY.xxx.`);
        }
        // Verify manual no kas matches cashType prefix
        if (!assignedNoKas.startsWith(item.cashType + ".")) {
          throw new Error(
            `No Kas manual '${assignedNoKas}' tidak sesuai dengan jenis kas '${item.cashType}'.`
          );
        }
        // Verify unique constraint across OTHER batches
        const collisionWithOtherBatch = await tx.accExpenseItem.findFirst({
          where: {
            noKas: assignedNoKas,
            batchId: { not: batch.id },
          },
        });
        if (collisionWithOtherBatch) {
          throw new Error(`No Kas '${assignedNoKas}' sudah terdaftar dalam sistem (harus unik).`);
        }
        if (!batchNoKas) {
          batchNoKas = assignedNoKas;
        }
      } else {
        // Atomic generation from database sequence
        if (!batchNoKas) {
          batchNoKas = await generateNextNoKas({
            prefix: item.cashType,
            year: batchYear,
            tx,
          });
        }
        assignedNoKas = batchNoKas;
      }

      // Create ACC Expense Item
      const createdItem = await tx.accExpenseItem.create({
        data: {
          batchId: batch.id,
          itemNo: itemIndex,
          noKas: assignedNoKas,
          cashType: item.cashType,
          projectId: item.projectId,
          subUnitId: item.subUnitId ?? null,
          categoryId: item.categoryId,
          subCategoryId: item.subCategoryId ?? null,
          picId: item.picId,
          assignmentStatus,
          dataScope,
          description: item.description,
          requestedAmount: item.requestedAmount ?? null,
          approvedAmount: item.approvedAmount,
          status: AccStatus.APPROVED,
          notes: item.notes ?? null,
        },
      });

      createdItems.push(createdItem);
    }

    if (batchNoKas) {
      await tx.submissionBatch.update({
        where: { id: batch.id },
        data: { noKas: batchNoKas },
      });
    }

    return {
      batch,
      items: createdItems,
    };
  };

  if (txClient) {
    return await runInTx(txClient);
  } else {
    return await prisma.$transaction(
      async (tx) => {
        return await runInTx(tx);
      },
      { maxWait: 10000, timeout: 25000 }
    );
  }
}
