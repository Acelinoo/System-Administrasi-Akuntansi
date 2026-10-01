import { prisma } from "../db/prisma";
import { JournalSourceType, Prisma, TransactionStatus, DataScope } from "@prisma/client";
import { CreateFundInflowInput, createFundInflowSchema } from "../validation/inflow.schema";
import { createJournalEntry, getCashAccountCoaId, voidJournalEntry } from "./journal.service";

export async function createFundInflow(
  rawInput: CreateFundInflowInput,
  txClient?: Prisma.TransactionClient
) {
  const validated = createFundInflowSchema.parse(rawInput);

  const runInTx = async (tx: Prisma.TransactionClient) => {
    // 1. Verify Destination Account
    const destAccount = await tx.cashAccount.findUnique({
      where: { id: validated.destinationAccountId },
    });

    if (!destAccount || !destAccount.isActive) {
      throw new Error(`Akun kas/bank tujuan tidak ditemukan atau tidak aktif.`);
    }

    // Determine targetScope
    const isRunningTests =
      typeof process !== "undefined" &&
      (process.env.NODE_ENV === "test" ||
        process.argv.some(
          (arg) => arg.includes("tests") || arg.includes("test")
        ));

    const targetScope =
      validated.dataScope ??
      (isRunningTests ||
      validated.referenceNo?.toUpperCase().startsWith("TEST") ||
      validated.sourceInfo?.toUpperCase().includes("TEST")
        ? DataScope.TEST
        : DataScope.REAL);

    // 2. Generate Inflow Number if not supplied
    const dateObj = new Date(validated.inflowDate);
    const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    const inflowNumber =
      validated.inflowNumber ??
      `IN-${yearMonth}-${Date.now().toString().slice(-4)}`;

    // 3. Create Fund Inflow Record
    const inflow = await tx.fundInflow.create({
      data: {
        inflowNumber,
        inflowDate: validated.inflowDate,
        destinationAccountId: validated.destinationAccountId,
        amount: validated.amount,
        sourceInfo: validated.sourceInfo,
        referenceNo: validated.referenceNo ?? null,
        status: TransactionStatus.POSTED,
        createdById: validated.createdById ?? null,
        dataScope: targetScope,
      },
    });

    // 4. Generate Cash Receipt Journal (Jurnal Kas Masuk)
    const debitCoaId = await getCashAccountCoaId(destAccount.accountType, tx);
    const equityCoa = await tx.coaAccount.findUnique({
      where: { accountCode: "3101" }, // Modal Operasional / Drop Dana Atasan
    });

    if (!equityCoa) {
      throw new Error("Akun COA 3101 (Modal Operasional / Drop Dana) tidak ditemukan dalam master.");
    }

    await createJournalEntry({
      journalNumber: `JRN-${inflow.inflowNumber}`,
      entryDate: validated.inflowDate,
      sourceType: JournalSourceType.FUND_INFLOW,
      sourceId: inflow.id,
      description: `Penerimaan Dana: ${validated.sourceInfo}`,
      lines: [
        {
          coaId: debitCoaId,
          debit: validated.amount,
          credit: 0,
          memo: `Penerimaan ke ${destAccount.accountName}`,
        },
        {
          coaId: equityCoa.id,
          debit: 0,
          credit: validated.amount,
          memo: `Dropping Dana Atasan / Manajemen`,
        },
      ],
      tx,
      dataScope: targetScope,
    });

    return inflow;
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

/**
 * Voids a posted fund inflow and its associated journal.
 */
export async function voidFundInflow(
  inflowId: string,
  voidReason: string,
  txClient?: Prisma.TransactionClient
) {
  if (!voidReason || voidReason.trim().length < 3) {
    throw new Error("Alasan pembatalan (voidReason) wajib diisi minimal 3 karakter.");
  }

  const runInTx = async (tx: Prisma.TransactionClient) => {
    const inflow = await tx.fundInflow.findUnique({
      where: { id: inflowId },
    });

    if (!inflow) {
      throw new Error(`Penerimaan dana dengan ID ${inflowId} tidak ditemukan.`);
    }

    if (inflow.status === TransactionStatus.VOID) {
      throw new Error(`Penerimaan dana '${inflow.inflowNumber}' sudah berstatus VOID.`);
    }

    // Update status to VOID
    const updated = await tx.fundInflow.update({
      where: { id: inflowId },
      data: {
        status: TransactionStatus.VOID,
        voidedAt: new Date(),
        voidReason,
      },
    });

    // Void associated Journal
    await voidJournalEntry(JournalSourceType.FUND_INFLOW, inflowId, voidReason, tx);

    return updated;
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
