import { prisma } from "../src/lib/db/prisma";
import { CashType, PaymentMethod, AccStatus, TransactionStatus, JournalSourceType } from "@prisma/client";
import { createSubmissionBatch } from "../src/lib/finance/acc.service";
import { generateNextNoKas } from "../src/lib/finance/no-kas";
import { createFundInflow, voidFundInflow } from "../src/lib/finance/inflow.service";
import { getCashAccountBalance, getAllCashBalances } from "../src/lib/finance/balance.service";
import { createDisbursement, voidDisbursement } from "../src/lib/finance/disbursement.service";

interface TestStats {
  passed: number;
  failed: number;
  total: number;
}

const stats: TestStats = { passed: 0, failed: 0, total: 0 };

function assert(condition: boolean, testName: string, failureDetail?: string) {
  stats.total++;
  if (condition) {
    stats.passed++;
    console.log(`  ✔ [PASS] ${testName}`);
  } else {
    stats.failed++;
    console.error(`  ✖ [FAIL] ${testName}: ${failureDetail || "Assertion failed"}`);
  }
}

async function runTestSuite() {
  console.log("\n========================================================");
  console.log("   PROTRACK FINANCIAL CORE AUTOMATED TEST SUITE        ");
  console.log("========================================================\n");

  // Fetch Master Data references needed for tests
  const alcentProject = await prisma.project.findUnique({ where: { code: "ALCENT" } });
  const sumedangProject = await prisma.project.findUnique({ where: { code: "SUMEDANG" } });
  const smpSubUnit = await prisma.projectSubUnit.findFirst({
    where: { projectId: alcentProject!.id, code: "SMP" },
  });
  const sipilSubUnit = await prisma.projectSubUnit.findFirst({
    where: { projectId: sumedangProject!.id, code: "SIPIL" },
  });
  const upahCategory = await prisma.expenseCategory.findUnique({ where: { code: "UPAH" } });
  const matCategory = await prisma.expenseCategory.findUnique({ where: { code: "MATERIAL" } });
  const picHeri = await prisma.fieldPic.findUnique({ where: { name: "PA HERI" } });
  const bcaNisaAccount = await prisma.cashAccount.findUnique({ where: { accountCode: "KAS_NISA" } });
  const mandiriAccount = await prisma.cashAccount.findUnique({ where: { accountCode: "MANDIRI_CBS" } });

  if (!alcentProject || !smpSubUnit || !upahCategory || !picHeri || !bcaNisaAccount || !mandiriAccount) {
    throw new Error("Master data prerequisite is missing. Please run seed first.");
  }

  // ----------------------------------------------------
  // TEST GROUP 1: CONCURRENCY TEST (100 Concurrent No Kas)
  // ----------------------------------------------------
  console.log("\n--- [GROUP 1] Concurrency & Atomic No Kas Generator ---");
  try {
    const promises: Promise<string>[] = [];
    const testYear = 2029; // isolated year for test
    for (let i = 0; i < 100; i++) {
      promises.push(generateNextNoKas({ prefix: CashType.KT, year: testYear }));
    }

    const generatedNumbers = await Promise.all(promises);
    const uniqueSet = new Set(generatedNumbers);

    assert(
      generatedNumbers.length === 100 && uniqueSet.size === 100,
      "100 Concurrent No Kas generation produces 100 unique sequential numbers without duplicates"
    );
    assert(
      generatedNumbers[0].startsWith("KT.29.") && generatedNumbers[99].startsWith("KT.29."),
      "Generated No Kas prefix and 2-digit year are properly formatted (KT.29.xxx)"
    );
  } catch (err: any) {
    assert(false, "100 Concurrent No Kas generation", err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 2: ACC SERVICE & INTEGRITY
  // ----------------------------------------------------
  console.log("\n--- [GROUP 2] ACC Batch & Expense Items Integrity ---");
  const testBatchCode = `BATCH-TEST-${Date.now()}`;
  let createdBatchItem1Id = "";
  let createdBatchItem2Id = "";
  let assignedNoKas1 = "";

  try {
    // 2.1 Create valid ACC Batch
    const result = await createSubmissionBatch({
      batchCode: testBatchCode,
      accDate: new Date("2026-07-02"),
      approvedByName: "Pa Giri",
      notes: "Test batch 2 Juli",
      items: [
        {
          cashType: CashType.KT,
          projectId: alcentProject.id,
          subUnitId: smpSubUnit.id,
          categoryId: upahCategory.id,
          picId: picHeri.id,
          description: "Upah Tukang Cat SMP",
          approvedAmount: 5000000,
          requestedAmount: 5000000,
        },
        {
          cashType: CashType.KT,
          projectId: alcentProject.id,
          subUnitId: smpSubUnit.id,
          categoryId: matCategory!.id,
          picId: picHeri.id,
          description: "Pembelian Cat Dinding SMP",
          approvedAmount: 2000000,
        },
      ],
    });

    createdBatchItem1Id = result.items[0].id;
    createdBatchItem2Id = result.items[1].id;
    assignedNoKas1 = result.items[0].noKas;

    assert(result.items.length === 2, "Valid ACC batch created with 2 items");
    assert(result.items[0].status === AccStatus.APPROVED, "Initial ACC item status is APPROVED");
    assert(result.items[0].noKas.startsWith("KT.26."), "Auto-generated No Kas starts with KT.26.");
  } catch (err: any) {
    assert(false, "Create valid ACC batch", err.message);
  }

  // 2.2 Reject zero approved amount
  try {
    await createSubmissionBatch({
      batchCode: `BATCH-ZERO-${Date.now()}`,
      accDate: new Date(),
      approvedByName: "Pak Direktur",
      items: [
        {
          cashType: CashType.KT,
          projectId: alcentProject.id,
          categoryId: upahCategory.id,
          picId: picHeri.id,
          description: "Zero item",
          approvedAmount: 0,
        },
      ],
    });
    assert(false, "Reject zero approved amount", "Should have thrown validation error");
  } catch {
    assert(true, "Reject zero approved amount successfully");
  }

  // 2.3 Reject negative approved amount
  try {
    await createSubmissionBatch({
      batchCode: `BATCH-NEG-${Date.now()}`,
      accDate: new Date(),
      approvedByName: "Pak Direktur",
      items: [
        {
          cashType: CashType.KT,
          projectId: alcentProject.id,
          categoryId: upahCategory.id,
          picId: picHeri.id,
          description: "Negative item",
          approvedAmount: -100000,
        },
      ],
    });
    assert(false, "Reject negative approved amount", "Should have thrown validation error");
  } catch {
    assert(true, "Reject negative approved amount successfully");
  }

  // 2.4 Reject duplicate No Kas
  try {
    await createSubmissionBatch({
      batchCode: `BATCH-DUP-${Date.now()}`,
      accDate: new Date(),
      approvedByName: "Pak Direktur",
      items: [
        {
          noKas: assignedNoKas1, // reuse existing No Kas
          cashType: CashType.KT,
          projectId: alcentProject.id,
          categoryId: upahCategory.id,
          picId: picHeri.id,
          description: "Duplicate item",
          approvedAmount: 1000000,
        },
      ],
    });
    assert(false, "Reject duplicate No Kas", "Should have thrown unique constraint error");
  } catch {
    assert(true, "Reject duplicate No Kas successfully");
  }

  // 2.5 Reject invalid Project / SubUnit combination (ALCENT -> SUMEDANG / SIPIL)
  try {
    await createSubmissionBatch({
      batchCode: `BATCH-INVALID-SUB-${Date.now()}`,
      accDate: new Date(),
      approvedByName: "Pak Direktur",
      items: [
        {
          cashType: CashType.KT,
          projectId: alcentProject.id, // ALCENT
          subUnitId: sipilSubUnit!.id, // SIPIL (belongs to SUMEDANG!)
          categoryId: upahCategory.id,
          picId: picHeri.id,
          description: "Mismatched subunit",
          approvedAmount: 1000000,
        },
      ],
    });
    assert(false, "Reject invalid Project + SubUnit integrity", "Should have rejected mismatched sub unit");
  } catch (err: any) {
    assert(
      err.message.includes("Integritas proyek gagal") || err.message.includes("Foreign key"),
      "Reject invalid Project + SubUnit combination (ALCENT -> SIPIL)"
    );
  }

  // ----------------------------------------------------
  // TEST GROUP 3: FUND INFLOW SERVICE & CASH BALANCE
  // ----------------------------------------------------
  console.log("\n--- [GROUP 3] Fund Inflow & Cash Balance Calculation ---");
  let inflowId = "";
  try {
    const balBefore = await getCashAccountBalance(bcaNisaAccount.id);

    const inflow = await createFundInflow({
      inflowDate: new Date("2026-07-04"),
      destinationAccountId: bcaNisaAccount.id,
      amount: 10000000, // Rp10.000.000 drop dana
      sourceInfo: "TF Dari MCBS Ke BCA Nisa",
    });
    inflowId = inflow.id;

    const balAfter = await getCashAccountBalance(bcaNisaAccount.id);

    assert(inflow.status === TransactionStatus.POSTED, "Fund inflow created with POSTED status");
    assert(
      balAfter.currentBalance === balBefore.currentBalance + 10000000,
      "Cash account balance increases exactly by inflow amount (+Rp10.000.000)"
    );

    // Verify Cash Receipt Journal was created
    const journal = await prisma.journalEntry.findFirst({
      where: {
        sourceType: JournalSourceType.FUND_INFLOW,
        sourceId: inflow.id,
        status: TransactionStatus.POSTED,
      },
      include: { lines: true },
    });

    assert(journal !== null, "Cash Receipt Journal automatically generated for Fund Inflow");
    assert(
      journal!.lines.length === 2 &&
        Number(journal!.lines[0].debit) === 10000000 &&
        Number(journal!.lines[1].credit) === 10000000,
      "Cash Receipt Journal is balanced: Debit Kas 10jt == Credit Drop Dana 10jt"
    );
  } catch (err: any) {
    assert(false, "Fund Inflow creation and balance update", err.message);
  }

  // 3.2 Reject negative Fund Inflow
  try {
    await createFundInflow({
      inflowDate: new Date(),
      destinationAccountId: bcaNisaAccount.id,
      amount: -5000000,
      sourceInfo: "Negative inflow test",
    });
    assert(false, "Reject negative Fund Inflow", "Should have thrown validation error");
  } catch {
    assert(true, "Reject negative Fund Inflow successfully");
  }

  // ----------------------------------------------------
  // TEST GROUP 4: DISBURSEMENT, PARTIAL PAYMENT & TOTAL INTEGRITY
  // ----------------------------------------------------
  console.log("\n--- [GROUP 4] Disbursement, Partial Payment & Total Integrity ---");

  // 4.1 Reject total disbursement mismatch
  try {
    await createDisbursement({
      disbursementDate: new Date("2026-07-04"),
      cashAccountId: bcaNisaAccount.id,
      paymentMethod: PaymentMethod.CASH,
      totalRealizedAmount: 9999999, // Mismatched intentionally
      items: [
        {
          accItemId: createdBatchItem1Id, // approved 5.000.000
          realizedAmount: 2000000,
        },
      ],
    });
    assert(false, "Reject total disbursement mismatch", "Should have rejected manipulated total");
  } catch (err: any) {
    assert(
      err.message.includes("Integritas total pencairan gagal"),
      "Reject total disbursement mismatch (Client Total != Sum of Items)"
    );
  }

  // 4.2 Reject insufficient funds
  try {
    const hugeAmount = 9999999999;
    await createDisbursement({
      disbursementDate: new Date("2026-07-04"),
      cashAccountId: bcaNisaAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: hugeAmount,
      items: [
        {
          accItemId: createdBatchItem1Id,
          realizedAmount: hugeAmount,
        },
      ],
    });
    assert(false, "Reject insufficient funds", "Should have rejected disbursement exceeding balance");
  } catch (err: any) {
    assert(
      err.message.includes("Saldo kas/bank tidak mencukupi") || err.message.includes("Overpayment"),
      "Reject disbursement due to insufficient funds (Negative balance forbidden)"
    );
  }

  // 4.3 Partial Payment #1: Tranche 1 (Rp2.000.000 out of Rp5.000.000)
  let disb1Id = "";
  try {
    const balBefore = await getCashAccountBalance(bcaNisaAccount.id);

    const disb1 = await createDisbursement({
      disbursementDate: new Date("2026-07-04"),
      cashAccountId: bcaNisaAccount.id,
      paymentMethod: PaymentMethod.CASH,
      totalRealizedAmount: 2000000,
      items: [
        {
          accItemId: createdBatchItem1Id,
          realizedAmount: 2000000,
        },
      ],
    });
    disb1Id = disb1.disbursement.id;

    const item1 = await prisma.accExpenseItem.findUnique({ where: { id: createdBatchItem1Id } });
    const balAfter = await getCashAccountBalance(bcaNisaAccount.id);

    assert(
      item1!.status === AccStatus.PARTIALLY_REALIZED,
      "Partial Payment #1 updates ACC status to PARTIALLY_REALIZED"
    );
    assert(
      balAfter.currentBalance === balBefore.currentBalance - 2000000,
      "Cash account balance decreased exactly by disbursement amount (-Rp2.000.000)"
    );
  } catch (err: any) {
    assert(false, "Partial Payment #1", err.message);
  }

  // 4.4 Reject overpayment on remaining outstanding
  // Item 1: Approved 5M, already realized 2M -> remaining is 3M. Trying to pay 3.5M must fail!
  try {
    await createDisbursement({
      disbursementDate: new Date("2026-07-04"),
      cashAccountId: bcaNisaAccount.id,
      paymentMethod: PaymentMethod.CASH,
      totalRealizedAmount: 3500000,
      items: [
        {
          accItemId: createdBatchItem1Id,
          realizedAmount: 3500000,
        },
      ],
    });
    assert(false, "Reject overpayment", "Should have rejected payment exceeding 3M outstanding");
  } catch (err: any) {
    assert(
      err.message.includes("Overpayment ditolak"),
      "Reject overpayment when realized exceeds remaining outstanding"
    );
  }

  // 4.5 Partial Payment #2 (Pelunasan Sisa Rp3.000.000)
  let disb2Id = "";
  try {
    const disb2 = await createDisbursement({
      disbursementDate: new Date("2026-07-06"),
      cashAccountId: bcaNisaAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 3000000,
      items: [
        {
          accItemId: createdBatchItem1Id,
          realizedAmount: 3000000,
        },
      ],
    });
    disb2Id = disb2.disbursement.id;

    const item1 = await prisma.accExpenseItem.findUnique({ where: { id: createdBatchItem1Id } });
    assert(
      item1!.status === AccStatus.FULLY_REALIZED,
      "Partial Payment #2 (Pelunasan) updates ACC status to FULLY_REALIZED"
    );
  } catch (err: any) {
    assert(false, "Partial Payment #2 Pelunasan", err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 5: JOURNAL INTEGRITY & IDEMPOTENCY
  // ----------------------------------------------------
  console.log("\n--- [GROUP 5] Double-Entry Journal Integrity & Idempotency ---");
  try {
    const journals = await prisma.journalEntry.findMany({
      where: {
        sourceType: JournalSourceType.DISBURSEMENT,
        sourceId: disb1Id,
      },
      include: { lines: true },
    });

    assert(journals.length === 1, "Disbursement generates exactly ONE active journal entry");

    const jrn = journals[0];
    const totalDebit = jrn.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = jrn.lines.reduce((s, l) => s + Number(l.credit), 0);

    assert(
      totalDebit === totalCredit && totalDebit === 2000000,
      `Journal double-entry is perfectly balanced: Debit ${totalDebit} === Credit ${totalCredit}`
    );
  } catch (err: any) {
    assert(false, "Journal verification", err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 6: VOID / REVERSAL LIFECYCLE
  // ----------------------------------------------------
  console.log("\n--- [GROUP 6] VOID & Reversal Lifecycle ---");
  try {
    const balBeforeVoid = await getCashAccountBalance(bcaNisaAccount.id);

    // VOID disbursement #2 (3.000.000)
    await voidDisbursement(disb2Id, "Salah rekening pembayaran");

    const balAfterVoid = await getCashAccountBalance(bcaNisaAccount.id);
    const item1AfterVoid = await prisma.accExpenseItem.findUnique({ where: { id: createdBatchItem1Id } });

    assert(
      balAfterVoid.currentBalance === balBeforeVoid.currentBalance + 3000000,
      "Voiding disbursement restores cash account balance (+Rp3.000.000)"
    );
    assert(
      item1AfterVoid!.status === AccStatus.PARTIALLY_REALIZED,
      "Voiding pelunasan recalculates ACC status back to PARTIALLY_REALIZED"
    );

    const voidedJournal = await prisma.journalEntry.findFirst({
      where: {
        sourceType: JournalSourceType.DISBURSEMENT,
        sourceId: disb2Id,
      },
    });
    assert(
      voidedJournal?.status === TransactionStatus.VOID,
      "Associated journal entry status updated to VOID while preserving historical audit record"
    );
  } catch (err: any) {
    assert(false, "VOID disbursement lifecycle", err.message);
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n========================================================");
  console.log(`   TEST RESULTS: ${stats.passed}/${stats.total} PASSED (${stats.failed} FAILED)`);
  console.log("========================================================\n");

  if (stats.failed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((e) => {
    console.error("Test execution fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
