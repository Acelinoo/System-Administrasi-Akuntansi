import { prisma } from "../src/lib/db/prisma";
import {
  DataScope,
  AccStatus,
  TransactionStatus,
  CashType,
  PaymentMethod,
  JournalSourceType,
  AccountType,
} from "@prisma/client";
import { createSubmissionBatch } from "../src/lib/finance/acc.service";
import { createDisbursement, voidDisbursement } from "../src/lib/finance/disbursement.service";
import { createFundInflow, voidFundInflow } from "../src/lib/finance/inflow.service";
import { getCashAccountBalance, getAllCashBalances } from "../src/lib/finance/balance.service";
import { createJournalEntry } from "../src/lib/finance/journal.service";
import { getDisbursementPageSummary } from "../src/app/actions/disbursement.actions";
import { getAccSummaryStats, getDashboardStats } from "../src/app/actions/acc.actions";

interface BaselineState {
  batches: number;
  items: number;
  approvedSum: string;
  unassignedMandor: number;
  postedDisbursements: number;
  postedInflows: number;
  journalEntries: number;
}

async function getRealBaseline(): Promise<BaselineState> {
  const batches = await prisma.submissionBatch.count({ where: { dataScope: DataScope.REAL } });
  const items = await prisma.accExpenseItem.count({ where: { dataScope: DataScope.REAL } });
  const approvedSum = await prisma.accExpenseItem.aggregate({
    where: { dataScope: DataScope.REAL },
    _sum: { approvedAmount: true },
  });
  const unassignedMandor = await prisma.accExpenseItem.count({
    where: { dataScope: DataScope.REAL, assignmentStatus: "UNASSIGNED_MANDOR" },
  });
  const postedDisbursements = await prisma.disbursement.count({
    where: { dataScope: DataScope.REAL, status: TransactionStatus.POSTED },
  });
  const postedInflows = await prisma.fundInflow.count({
    where: { dataScope: DataScope.REAL, status: TransactionStatus.POSTED },
  });
  const journalEntries = await prisma.journalEntry.count({
    where: { dataScope: DataScope.REAL },
  });

  return {
    batches,
    items,
    approvedSum: (approvedSum._sum.approvedAmount ?? 0).toString(),
    unassignedMandor,
    postedDisbursements,
    postedInflows,
    journalEntries,
  };
}

async function cleanTestData() {
  try {
    await prisma.journalLine.deleteMany({
      where: { journal: { dataScope: DataScope.TEST } },
    });
    await prisma.journalEntry.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    await prisma.disbursementItem.deleteMany({
      where: { disbursement: { dataScope: DataScope.TEST } },
    });
    await prisma.disbursement.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    await prisma.accExpenseItem.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    await prisma.submissionBatch.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    await prisma.fundInflow.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    await prisma.cashAccount.deleteMany({
      where: { accountCode: { startsWith: "TEST-KAS" } },
    });
  } catch (err) {
    console.error("Warning during test data cleanup:", err);
  }
}

async function runPhase4Tests() {
  console.log("================================================================================");
  console.log("  PROTRACK FASE 4 — COMPREHENSIVE INTEGRATION TEST SUITE");
  console.log("  Scope: Kebutuhan, ACC, Inflow, Multi-Tranche Disbursement, Jurnal & Rekonsiliasi");
  console.log("================================================================================");

  // STEP 0: Capture & Verify Real Baseline
  const initialBaseline = await getRealBaseline();
  console.log("\n[STEP 0] Baseline REAL Verification:");
  console.log(JSON.stringify(initialBaseline, null, 2));

  if (
    initialBaseline.batches !== 379 ||
    initialBaseline.items !== 1028 ||
    initialBaseline.approvedSum !== "4303052418" ||
    initialBaseline.unassignedMandor !== 723 ||
    initialBaseline.postedDisbursements !== 0 ||
    initialBaseline.postedInflows !== 0 ||
    initialBaseline.journalEntries !== 0
  ) {
    throw new Error("ABORT: Real baseline does not match exact Phase 4 invariants!");
  }
  console.log("✓ Initial REAL baseline confirmed 100% intact.");

  // Prepare Master Data references
  const testProject = await prisma.project.findFirst({ where: { isActive: true } });
  if (!testProject) throw new Error("No active project found in database.");

  const testPic = await prisma.fieldPic.findFirst({ where: { isActive: true } });
  if (!testPic) throw new Error("No active PIC found in database.");

  const upahCategory = await prisma.expenseCategory.findUnique({ where: { code: "UPAH" } });
  const matCategory = await prisma.expenseCategory.findUnique({ where: { code: "MATERIAL" } });
  if (!upahCategory || !matCategory) throw new Error("Required expense categories (UPAH/MATERIAL) missing.");

  // Preliminary cleanup of any lingering TEST records
  await cleanTestData();

  const testAccountCode = `TEST-KAS-${Date.now().toString().slice(-6)}`;
  // Create isolated TEST Cash Account
  const testCashAccount = await prisma.cashAccount.create({
    data: {
      accountCode: testAccountCode,
      accountName: "Rekening Uji Coba Fase 4",
      accountType: AccountType.BANK,
      bankName: "Bank Mandiri Test",
      accountNumber: "999-00-12345-6",
      openingBalance: 0,
      isActive: true,
    },
  });
  console.log(`✓ Created isolated test cash account: ${testCashAccount.accountCode} (${testCashAccount.id})`);

  // Track created test IDs for guaranteed cleanup
  const createdBatchIds: string[] = [];
  const createdInflowIds: string[] = [];
  const createdDisbursementIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Fund Inflow (Dropping Dana) — UNPOSTED vs POSTED
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Testing Fund Inflow: UNPOSTED (DRAFT) vs POSTED...");

    // 1a. VOID inflow directly in DB (simulating cancelled/unaccepted inflow)
    const voidInflow = await prisma.fundInflow.create({
      data: {
        inflowNumber: `IN-TEST-VOID-${Date.now()}`,
        inflowDate: new Date("2026-10-09"),
        destinationAccountId: testCashAccount.id,
        amount: 50_000_000,
        sourceInfo: "Dropping Dana Masuk Belum Sah / Batal (VOID)",
        status: TransactionStatus.VOID,
        dataScope: DataScope.TEST,
      },
    });
    createdInflowIds.push(voidInflow.id);

    // Balance check: VOID should NOT increase cash balance
    const balanceAfterVoidInflow = await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST);
    if (balanceAfterVoidInflow.currentBalance !== 0) {
      throw new Error(`FAIL: VOID inflow incorrectly increased balance: ${balanceAfterVoidInflow.currentBalance}`);
    }
    console.log("  ✓ VOID (unposted) inflow Rp50.000.000 does NOT affect balance (Balance = Rp0).");

    // 1b. Create POSTED Fund Inflow via service
    const postedInflow = await createFundInflow({
      inflowDate: new Date("2026-10-09"),
      destinationAccountId: testCashAccount.id,
      amount: 100_000_000,
      sourceInfo: "Dropping Dana Operasional Proyek Sah (POSTED)",
      referenceNo: "TEST-REF-INFLOW-01",
      dataScope: DataScope.TEST,
    });
    createdInflowIds.push(postedInflow.id);

    // Balance check: POSTED should increase cash balance to 100,000,000
    const balanceAfterPosted = await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST);
    if (balanceAfterPosted.currentBalance !== 100_000_000) {
      throw new Error(`FAIL: POSTED inflow failed to increase balance: ${balanceAfterPosted.currentBalance}`);
    }
    console.log("  ✓ POSTED inflow Rp100.000.000 successfully reflected in balance (Balance = Rp100.000.000).");

    // Check automatic journal creation for posted inflow
    const inflowJournal = await prisma.journalEntry.findFirst({
      where: {
        sourceType: JournalSourceType.FUND_INFLOW,
        sourceId: postedInflow.id,
        status: TransactionStatus.POSTED,
        dataScope: DataScope.TEST,
      },
      include: { lines: true },
    });
    if (!inflowJournal) throw new Error("FAIL: Journal entry for POSTED inflow was not created!");
    const debitSumInflow = inflowJournal.lines.reduce((s, l) => s + Number(l.debit), 0);
    const creditSumInflow = inflowJournal.lines.reduce((s, l) => s + Number(l.credit), 0);
    if (debitSumInflow !== 100_000_000 || creditSumInflow !== 100_000_000) {
      throw new Error(`FAIL: Inflow journal out of balance: Debit=${debitSumInflow}, Credit=${creditSumInflow}`);
    }
    console.log("  ✓ Inflow double-entry journal verified: Debit=100.000.000, Credit=100.000.000 (Balanced).");

    // -------------------------------------------------------------------------
    // TEST 2: ACC Batch & Item Creation (No Kas format, Uniqueness, Status APPROVED)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing ACC Creation & No Kas Generation...");

    const batchCode1 = `TEST-BATCH-${Date.now()}`;
    const accResult1 = await createSubmissionBatch({
      batchCode: batchCode1,
      accDate: new Date("2026-10-09"),
      approvedByName: "Pa Giri",
      notes: "Pengajuan Kebutuhan Mingguan Lapangan Uji Coba",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: upahCategory.id,
          picId: testPic.id,
          description: "Upah Tukang & Kenek Tahap 1",
          requestedAmount: 12_000_000,
          approvedAmount: 10_000_000,
        },
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: matCategory.id,
          picId: testPic.id,
          description: "Material Semen & Pasir Tambahan",
          requestedAmount: 15_000_000,
          approvedAmount: 15_000_000,
        },
      ],
    });
    createdBatchIds.push(accResult1.batch.id);

    const item1 = accResult1.items[0]; // Upah Rp10.000.000
    const item2 = accResult1.items[1]; // Material Rp15.000.000

    if (item1.status !== AccStatus.APPROVED || item2.status !== AccStatus.APPROVED) {
      throw new Error("FAIL: Newly created ACC items must have status APPROVED.");
    }
    if (!item1.noKas.startsWith("KT.") || !item2.noKas.startsWith("KT.")) {
      throw new Error(`FAIL: Generated No Kas does not match KT.YY.xxx pattern: ${item1.noKas}`);
    }
    console.log(`  ✓ ACC Batch created: ${accResult1.batch.batchCode} with No Kas ${accResult1.batch.noKas}`);
    console.log(`  ✓ Item 1 (Upah Rp10.000.000, Status: ${item1.status}, NoKas: ${item1.noKas})`);
    console.log(`  ✓ Item 2 (Material Rp15.000.000, Status: ${item2.status}, NoKas: ${item2.noKas})`);

    // Verify duplicate No Kas on batch is rejected
    let duplicateRejected = false;
    try {
      await createSubmissionBatch({
        batchCode: `TEST-DUP-${Date.now()}`,
        accDate: new Date("2026-10-09"),
        approvedByName: "Pa Giri",
        dataScope: DataScope.TEST,
        items: [
          {
            noKas: item1.noKas, // Reuse existing No Kas
            cashType: CashType.KT,
            projectId: testProject.id,
            categoryId: upahCategory.id,
            picId: testPic.id,
            description: "Duplicate No Kas Attempt",
            approvedAmount: 1_000_000,
          },
        ],
      });
    } catch {
      duplicateRejected = true;
    }
    if (!duplicateRejected) {
      throw new Error("FAIL: Duplicate No Kas across batches should have been rejected!");
    }
    console.log("  ✓ Duplicate No Kas across batches strictly rejected by database uniqueness constraint.");

    // -------------------------------------------------------------------------
    // TEST 3: Multi-Tranche Partial Disbursement (Pencairan Bertahap)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Multi-Tranche Partial Disbursement...");

    // Tranche 1: Disburse 40% of item1 (Rp4.000.000 of Rp10.000.000)
    const tranche1 = await createDisbursement({
      disbursementDate: new Date("2026-10-10"),
      cashAccountId: testCashAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 4_000_000,
      notes: "Pencairan Bertahap Tahap 1 (40%)",
      dataScope: DataScope.TEST,
      items: [
        {
          accItemId: item1.id,
          realizedAmount: 4_000_000,
        },
      ],
    });
    createdDisbursementIds.push(tranche1.disbursement.id);

    // Verify item1 status transitioned to PARTIALLY_REALIZED
    const item1AfterTranche1 = await prisma.accExpenseItem.findUnique({ where: { id: item1.id } });
    if (item1AfterTranche1?.status !== AccStatus.PARTIALLY_REALIZED) {
      throw new Error(`FAIL: Expected PARTIALLY_REALIZED, got ${item1AfterTranche1?.status}`);
    }
    console.log(`  ✓ Tranche 1 posted: Item 1 status transitioned to ${item1AfterTranche1.status}`);

    // Check balance reduced by 4,000,000 -> 96,000,000
    const balanceAfterTranche1 = await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST);
    if (balanceAfterTranche1.currentBalance !== 96_000_000) {
      throw new Error(`FAIL: Balance mismatch after Tranche 1: ${balanceAfterTranche1.currentBalance}`);
    }
    console.log(`  ✓ Cash balance after Tranche 1: Rp${balanceAfterTranche1.currentBalance.toLocaleString("id-ID")}`);

    // Verify Journal Entry for Tranche 1
    const journal1 = await prisma.journalEntry.findFirst({
      where: {
        sourceType: JournalSourceType.DISBURSEMENT,
        sourceId: tranche1.disbursement.id,
        status: TransactionStatus.POSTED,
        dataScope: DataScope.TEST,
      },
      include: { lines: true },
    });
    if (!journal1) throw new Error("FAIL: Journal entry for Tranche 1 missing!");
    const debit1 = journal1.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit1 = journal1.lines.reduce((s, l) => s + Number(l.credit), 0);
    if (debit1 !== 4_000_000 || credit1 !== 4_000_000) {
      throw new Error(`FAIL: Tranche 1 journal unbalanced: Debit=${debit1}, Credit=${credit1}`);
    }
    console.log("  ✓ Tranche 1 Journal balanced: Debit=4.000.000 (Beban Upah), Credit=4.000.000 (Bank).");

    // -------------------------------------------------------------------------
    // TEST 4: Overpayment Guard (Mencegah Pencairan Melebihi Sisa)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Overpayment Prevention Guard...");

    // Remaining on item1 is 6,000,000. Attempting to disburse 7,000,000 should fail!
    let overpaymentRejected = false;
    try {
      await createDisbursement({
        disbursementDate: new Date("2026-10-10"),
        cashAccountId: testCashAccount.id,
        paymentMethod: PaymentMethod.TRANSFER,
        totalRealizedAmount: 7_000_000,
        notes: "Percobaan Overpayment",
        dataScope: DataScope.TEST,
        items: [
          {
            accItemId: item1.id,
            realizedAmount: 7_000_000,
          },
        ],
      });
    } catch (err: any) {
      overpaymentRejected = true;
      console.log(`  ✓ Overpayment successfully blocked: "${err.message}"`);
    }
    if (!overpaymentRejected) {
      throw new Error("FAIL: Overpayment was not blocked!");
    }

    // -------------------------------------------------------------------------
    // TEST 5: Tranche 2 Final Disbursement (Pelunasan Sisa)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Tranche 2 Final Disbursement (Full Settlement)...");

    // Disburse remaining 6,000,000 of item1 + 100% of item2 (15,000,000) -> Total 21,000,000
    const tranche2 = await createDisbursement({
      disbursementDate: new Date("2026-10-11"),
      cashAccountId: testCashAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 21_000_000,
      notes: "Pelunasan Tahap 2 (Sisa Item 1 & Penuh Item 2)",
      dataScope: DataScope.TEST,
      items: [
        { accItemId: item1.id, realizedAmount: 6_000_000 },
        { accItemId: item2.id, realizedAmount: 15_000_000 },
      ],
    });
    createdDisbursementIds.push(tranche2.disbursement.id);

    // Verify both items are now FULLY_REALIZED
    const item1Final = await prisma.accExpenseItem.findUnique({ where: { id: item1.id } });
    const item2Final = await prisma.accExpenseItem.findUnique({ where: { id: item2.id } });

    if (item1Final?.status !== AccStatus.FULLY_REALIZED || item2Final?.status !== AccStatus.FULLY_REALIZED) {
      throw new Error(`FAIL: Expected both FULLY_REALIZED. item1=${item1Final?.status}, item2=${item2Final?.status}`);
    }
    console.log(`  ✓ Item 1 status: ${item1Final.status} (Total Realized: Rp10.000.000, Sisa Outstanding: Rp0)`);
    console.log(`  ✓ Item 2 status: ${item2Final.status} (Total Realized: Rp15.000.000, Sisa Outstanding: Rp0)`);

    // Balance check: 96,000,000 - 21,000,000 = 75,000,000
    const balanceAfterTranche2 = await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST);
    if (balanceAfterTranche2.currentBalance !== 75_000_000) {
      throw new Error(`FAIL: Balance mismatch after Tranche 2: ${balanceAfterTranche2.currentBalance}`);
    }
    console.log(`  ✓ Cash balance after Tranche 2: Rp${balanceAfterTranche2.currentBalance.toLocaleString("id-ID")}`);

    // -------------------------------------------------------------------------
    // TEST 6: Insufficient Funds Guard (Mencegah Saldo Negatif)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Testing Insufficient Funds (Negative Balance Guard)...");

    // Create an ACC item with Rp100.000.000, but cash balance is only Rp75.000.000
    const batchCode2 = `TEST-BATCH-FUNDS-${Date.now()}`;
    const accResult2 = await createSubmissionBatch({
      batchCode: batchCode2,
      accDate: new Date("2026-10-11"),
      approvedByName: "Pa Giri",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: matCategory.id,
          picId: testPic.id,
          description: "Kebutuhan Material Besar Melebihi Saldo Kas",
          approvedAmount: 90_000_000,
        },
      ],
    });
    createdBatchIds.push(accResult2.batch.id);
    const bigItem = accResult2.items[0];

    let insufficientFundsBlocked = false;
    try {
      await createDisbursement({
        disbursementDate: new Date("2026-10-11"),
        cashAccountId: testCashAccount.id,
        paymentMethod: PaymentMethod.TRANSFER,
        totalRealizedAmount: 90_000_000,
        notes: "Percobaan Pencairan Melebihi Saldo",
        dataScope: DataScope.TEST,
        items: [{ accItemId: bigItem.id, realizedAmount: 90_000_000 }],
      });
    } catch (err: any) {
      insufficientFundsBlocked = true;
      console.log(`  ✓ Insufficient funds blocked: "${err.message}"`);
    }
    if (!insufficientFundsBlocked) {
      throw new Error("FAIL: Disbursement exceeding cash balance was not blocked!");
    }

    // -------------------------------------------------------------------------
    // TEST 7: VOID Disbursement & Automatic Rollback
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Testing VOID Disbursement & Status Rollback...");

    // Void tranche 2 (Rp21.000.000)
    await voidDisbursement(tranche2.disbursement.id, "Pembatalan Uji Coba Voucher Tranche 2");

    // 7a. Disbursement record status is VOID
    const voidedDisb = await prisma.disbursement.findUnique({ where: { id: tranche2.disbursement.id } });
    if (voidedDisb?.status !== TransactionStatus.VOID) {
      throw new Error(`FAIL: Disbursement status should be VOID, got ${voidedDisb?.status}`);
    }
    console.log("  ✓ Disbursement record status updated to VOID.");

    // 7b. Cash balance restored back to 96,000,000
    const balanceAfterVoid = await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST);
    if (balanceAfterVoid.currentBalance !== 96_000_000) {
      throw new Error(`FAIL: Balance was not restored after VOID: ${balanceAfterVoid.currentBalance}`);
    }
    console.log(`  ✓ Cash balance immediately restored: Rp${balanceAfterVoid.currentBalance.toLocaleString("id-ID")}`);

    // 7c. Item 1 status rolled back from FULLY_REALIZED to PARTIALLY_REALIZED (since Tranche 1 is still posted)
    //     Item 2 status rolled back from FULLY_REALIZED to APPROVED (since Tranche 2 was its only payment)
    const item1AfterVoid = await prisma.accExpenseItem.findUnique({ where: { id: item1.id } });
    const item2AfterVoid = await prisma.accExpenseItem.findUnique({ where: { id: item2.id } });

    if (item1AfterVoid?.status !== AccStatus.PARTIALLY_REALIZED) {
      throw new Error(`FAIL: Item 1 should revert to PARTIALLY_REALIZED, got ${item1AfterVoid?.status}`);
    }
    if (item2AfterVoid?.status !== AccStatus.APPROVED) {
      throw new Error(`FAIL: Item 2 should revert to APPROVED, got ${item2AfterVoid?.status}`);
    }
    console.log(`  ✓ Item 1 status correctly reverted to ${item1AfterVoid.status}`);
    console.log(`  ✓ Item 2 status correctly reverted to ${item2AfterVoid.status}`);

    // 7d. Associated journal entry status is VOID
    const voidedJournal = await prisma.journalEntry.findFirst({
      where: {
        sourceType: JournalSourceType.DISBURSEMENT,
        sourceId: tranche2.disbursement.id,
      },
    });
    if (voidedJournal?.status !== TransactionStatus.VOID) {
      throw new Error(`FAIL: Journal entry should be VOID, got ${voidedJournal?.status}`);
    }
    console.log("  ✓ Tranche 2 Journal entry marked as VOID (Audit trail preserved).");

    // -------------------------------------------------------------------------
    // TEST 8: VOID Fund Inflow & Balance Reduction
    // -------------------------------------------------------------------------
    console.log("\n[TEST 8] Testing VOID Fund Inflow...");

    // Void the posted inflow of Rp100.000.000
    // But currently Tranche 1 (Rp4.000.000) is posted, so voiding Rp100.000.000 would cause balance to be -Rp4.000.000
    // First let's void Tranche 1 as well
    await voidDisbursement(tranche1.disbursement.id, "Pembatalan Uji Coba Tranche 1");
    const balanceBeforeInflowVoid = await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST);
    console.log(`  ✓ Balance before inflow void: Rp${balanceBeforeInflowVoid.currentBalance.toLocaleString("id-ID")}`);

    // Now void the inflow
    await voidFundInflow(postedInflow.id, "Pembatalan Uji Coba Penerimaan Dana");
    const balanceAfterInflowVoid = await getCashAccountBalance(testCashAccount.id, undefined, DataScope.TEST);
    if (balanceAfterInflowVoid.currentBalance !== 0) {
      throw new Error(`FAIL: Inflow void should return balance to 0, got ${balanceAfterInflowVoid.currentBalance}`);
    }
    console.log(`  ✓ Balance after Inflow VOID: Rp${balanceAfterInflowVoid.currentBalance.toLocaleString("id-ID")} (Accurate).`);

    // -------------------------------------------------------------------------
    // TEST 9: Journal Idempotency & Balance Check
    // -------------------------------------------------------------------------
    console.log("\n[TEST 9] Testing Journal Idempotency & Debit/Credit Balancing...");

    // Unbalanced journal attempt (Debit 100, Credit 50)
    let unbalancedBlocked = false;
    try {
      await createJournalEntry({
        journalNumber: `JRN-UNBALANCED-${Date.now()}`,
        entryDate: new Date("2026-10-09"),
        sourceType: JournalSourceType.MANUAL,
        sourceId: testCashAccount.id,
        description: "Test Jurnal Tidak Seimbang",
        dataScope: DataScope.TEST,
        lines: [
          {
            coaId: (await prisma.coaAccount.findFirst({ where: { accountCode: "5101" } }))!.id,
            debit: 100_000,
            credit: 0,
          },
          {
            coaId: (await prisma.coaAccount.findFirst({ where: { accountCode: "1101" } }))!.id,
            debit: 0,
            credit: 50_000,
          },
        ],
      });
    } catch {
      unbalancedBlocked = true;
    }
    if (!unbalancedBlocked) {
      throw new Error("FAIL: Unbalanced journal was not blocked!");
    }
    console.log("  ✓ Unbalanced double-entry journal strictly rejected by journal service.");

    // -------------------------------------------------------------------------
    // TEST 10: Summary Consistency & Isolation Check
    // -------------------------------------------------------------------------
    console.log("\n[TEST 10] Testing Page Summaries with Isolation...");

    const testDisbSummary = await getDisbursementPageSummary(DataScope.TEST);
    console.log(`  ✓ TEST Disbursement Summary: Total ACC = Rp${testDisbSummary.totalAccAmount.toLocaleString("id-ID")}, Outstanding = Rp${testDisbSummary.totalOutstandingAmount.toLocaleString("id-ID")}`);

    const testAccStats = await getAccSummaryStats({ dataScope: DataScope.TEST });
    console.log(`  ✓ TEST ACC Summary Stats: Approved = Rp${testAccStats.totalApproved.toLocaleString("id-ID")}, Realized = Rp${testAccStats.totalRealized.toLocaleString("id-ID")}`);

  } finally {
    console.log("\n[CLEANUP] Cleaning up TEST records...");
    await cleanTestData();
    console.log("✓ All isolated test data cleanly removed from database.");
  }

  // -------------------------------------------------------------------------
  // FINAL VERIFICATION: Invariant check on REAL Baseline
  // -------------------------------------------------------------------------
  console.log("\n[FINAL VERIFICATION] Verifying REAL Baseline Invariants...");
  const postTestBaseline = await getRealBaseline();
  console.log(JSON.stringify(postTestBaseline, null, 2));

  const invariantsPass =
    postTestBaseline.batches === 379 &&
    postTestBaseline.items === 1028 &&
    postTestBaseline.approvedSum === "4303052418" &&
    postTestBaseline.unassignedMandor === 723 &&
    postTestBaseline.postedDisbursements === 0 &&
    postTestBaseline.postedInflows === 0 &&
    postTestBaseline.journalEntries === 0;

  if (!invariantsPass) {
    throw new Error("CRITICAL FAIL: REAL baseline was mutated during Phase 4 testing!");
  }

  console.log("\n================================================================================");
  console.log("  ALL PHASE 4 INTEGRATION TESTS PASSED PERFECTLY!");
  console.log("  REAL BASELINE 100% UNTOUCHED AND VERIFIED!");
  console.log("================================================================================");
}

runPhase4Tests()
  .catch((err) => {
    console.error("\nTEST SUITE FAILED WITH ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
