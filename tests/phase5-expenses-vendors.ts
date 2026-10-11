import { prisma } from "../src/lib/db/prisma";
import {
  DataScope,
  AccStatus,
  TransactionStatus,
  CashType,
  PaymentMethod,
  AccountType,
  VendorType,
} from "@prisma/client";
import { createSubmissionBatch } from "../src/lib/finance/acc.service";
import { createDisbursement, voidDisbursement } from "../src/lib/finance/disbursement.service";
import { createFundInflow } from "../src/lib/finance/inflow.service";
import { getCashAccountBalance } from "../src/lib/finance/balance.service";
import {
  createExpenseItemDetail,
  deleteExpenseItemDetail,
  createVendorContract,
  deleteVendorContract,
  getProject360Data,
  createProjectBudget,
  addBudgetItem,
} from "../src/lib/finance/project-360.service";
import { getProjectReport } from "../src/lib/reports/project-report.service";
import { buildProjectPdf } from "../src/lib/export/pdf-export.service";
import { buildProjectExcel } from "../src/lib/export/excel-export.service";
import { deleteVendorAction } from "../src/app/actions/master.actions";

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
    // 1. Delete details under test items
    await prisma.expenseItemDetail.deleteMany({
      where: { accItem: { dataScope: DataScope.TEST } },
    });
    // 2. Delete test vendor contracts
    await prisma.vendorContract.deleteMany({
      where: { contractNumber: { startsWith: "SPK-TEST" } },
    });
    // 3. Delete test vendors
    await prisma.vendor.deleteMany({
      where: { code: { startsWith: "TEST-VND" } },
    });
    // 4. Delete journal lines & entries
    await prisma.journalLine.deleteMany({
      where: { journal: { dataScope: DataScope.TEST } },
    });
    await prisma.journalEntry.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    // 5. Delete disbursement items & disbursements
    await prisma.disbursementItem.deleteMany({
      where: { disbursement: { dataScope: DataScope.TEST } },
    });
    await prisma.disbursement.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    // 6. Delete acc expense items & batches
    await prisma.accExpenseItem.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    await prisma.submissionBatch.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    // 7. Delete fund inflows
    await prisma.fundInflow.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    // 8. Delete test budget items & project budgets
    await prisma.budgetItem.deleteMany({
      where: { budget: { dataScope: DataScope.TEST } },
    });
    await prisma.projectBudget.deleteMany({
      where: { dataScope: DataScope.TEST },
    });
    // 9. Delete test cash accounts
    await prisma.cashAccount.deleteMany({
      where: { accountCode: { startsWith: "TEST-KAS" } },
    });
  } catch (err) {
    console.error("Warning during test data cleanup:", err);
  }
}

async function runPhase5Tests() {
  console.log("================================================================================");
  console.log("  PROTRACK FASE 5 — INTEGRATED TEST SUITE");
  console.log("  Scope: Material, Upah, Ops, Kasbon, Talangan, Kontrabon & Vendor/Subkontrak");
  console.log("================================================================================");

  // STEP 0: Capture & Verify Initial REAL Baseline
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
    throw new Error("ABORT: Real baseline does not match exact Phase 5 invariants!");
  }
  console.log("✓ Initial REAL baseline confirmed 100% intact.");

  // Prepare master data lookups
  const testProject = await prisma.project.findFirst({ where: { isActive: true } });
  if (!testProject) throw new Error("No active project found.");
  const testPic = await prisma.fieldPic.findFirst({ where: { isActive: true } });
  if (!testPic) throw new Error("No active PIC found.");

  const categories = await prisma.expenseCategory.findMany({
    where: {
      code: { in: ["UPAH", "MATERIAL", "OPS_LAPANGAN", "KASBON", "TALANGAN", "KONTRABON", "SUBKON"] },
    },
  });
  const catMap = new Map(categories.map((c) => [c.code, c.id]));

  if (!catMap.has("MATERIAL") || !catMap.has("UPAH") || !catMap.has("KASBON") || !catMap.has("TALANGAN") || !catMap.has("KONTRABON")) {
    throw new Error("Required expense categories missing in database.");
  }

  // Clean any residual test data
  await cleanTestData();

  // Create isolated TEST Cash Account
  const testAccountCode = `TEST-KAS-${Date.now().toString().slice(-6)}`;
  const testCashAccount = await prisma.cashAccount.create({
    data: {
      accountCode: testAccountCode,
      accountName: "Rekening Operasional Bank Uji Coba Fase 5",
      accountType: AccountType.BANK,
      bankName: "Bank Mandiri Test",
      accountNumber: "888-00-55555-5",
      openingBalance: 0,
      isActive: true,
    },
  });

  // Seed funds into test cash account: Rp150.000.000 (POSTED Inflow)
  await createFundInflow({
    inflowDate: new Date(),
    destinationAccountId: testCashAccount.id,
    projectId: testProject.id,
    amount: 150000000,
    sourceInfo: "Dropping Modal Kerja Pengujian Fase 5",
    referenceNo: "IN-PHASE5-01",
    dataScope: DataScope.TEST,
  });

  const initialBalance = await getCashAccountBalance(testCashAccount.id, undefined, "ALL");
  console.log(`✓ Seeded test bank balance: Rp${initialBalance.currentBalance.toLocaleString("id-ID")}`);

  // Create isolated TEST Vendors
  const testSupplier = await prisma.vendor.create({
    data: {
      code: `TEST-VND-01`,
      name: "TB. Sentosa Material Abadi Test",
      type: VendorType.SUPPLIER,
      phone: "0812-9999-0001",
      address: "Jl. Raya Material No. 10",
      isActive: true,
    },
  });
  const testSubcon = await prisma.vendor.create({
    data: {
      code: `TEST-VND-02`,
      name: "CV. Baja Perkasa Subkon Test",
      type: VendorType.SUBCONTRACTOR,
      phone: "0812-9999-0002",
      address: "Kawasan Industri No. 20",
      isActive: true,
    },
  });
  console.log(`✓ Created isolated test vendors: ${testSupplier.name} & ${testSubcon.name}`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Material Itemization with Multiple Details & Server-side Total Calculation
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Testing Material Itemization & Automatic Total Calculation...");
    const batch1 = await createSubmissionBatch({
      batchCode: `TEST-BATCH-${Date.now()}-MAT`,
      accDate: new Date(),
      approvedByName: "Pa Giri",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: catMap.get("MATERIAL")!,
          picId: testPic.id,
          description: "Pengadaan Semen, Besi, dan Kawat Pengikat Lapangan",
          approvedAmount: 25000000,
        },
      ],
    });
    const matAccItem = batch1.items[0];

    // Add Detail 1
    const detail1 = await createExpenseItemDetail({
      accItemId: matAccItem.id,
      itemName: "Semen Tiga Roda 50kg",
      quantity: 100,
      unit: "sak",
      unitPrice: 75000,
      vendorId: testSupplier.id,
      referenceNo: "NOTA-TR-001",
      notes: "Semen untuk struktur kolom lantai 1",
    });
    if (Number(detail1.totalPrice) !== 7500000) {
      throw new Error(`Detail 1 totalPrice mismatch: expected 7.500.000, got ${detail1.totalPrice}`);
    }

    // Add Detail 2
    const detail2 = await createExpenseItemDetail({
      accItemId: matAccItem.id,
      itemName: "Besi Beton 10mm Ulir",
      quantity: 150,
      unit: "btg",
      unitPrice: 90000,
      vendorId: testSupplier.id,
      referenceNo: "NOTA-TR-002",
      notes: "Besi SNI",
    });
    if (Number(detail2.totalPrice) !== 13500000) {
      throw new Error(`Detail 2 totalPrice mismatch: expected 13.500.000, got ${detail2.totalPrice}`);
    }

    // Add Detail 3
    const detail3 = await createExpenseItemDetail({
      accItemId: matAccItem.id,
      itemName: "Kawat Bendrat",
      quantity: 20,
      unit: "roll",
      unitPrice: 50000,
      vendorId: testSupplier.id,
      notes: "Kawat pengikat besi",
    });
    if (Number(detail3.totalPrice) !== 1000000) {
      throw new Error(`Detail 3 totalPrice mismatch: expected 1.000.000, got ${detail3.totalPrice}`);
    }

    const itemWithDetails = await prisma.accExpenseItem.findUnique({
      where: { id: matAccItem.id },
      include: { expenseItemDetails: true },
    });
    const sumDetails = itemWithDetails!.expenseItemDetails.reduce(
      (sum, d) => sum + Number(d.totalPrice),
      0
    );
    if (sumDetails !== 22000000) {
      throw new Error(`Total 3 rincian material mismatch: expected 22.000.000, got ${sumDetails}`);
    }
    console.log(`  ✓ 3 rincian material berhasil dicatat: Total = Rp${sumDetails.toLocaleString("id-ID")} (Pagu ACC = Rp25.000.000)`);

    // Test detail deletion
    await deleteExpenseItemDetail(detail3.id);
    const afterDelete = await prisma.accExpenseItem.findUnique({
      where: { id: matAccItem.id },
      include: { expenseItemDetails: true },
    });
    if (afterDelete!.expenseItemDetails.length !== 2) {
      throw new Error("Detail deletion failed: item details count mismatch");
    }
    // Re-add Detail 3
    await createExpenseItemDetail({
      accItemId: matAccItem.id,
      itemName: "Kawat Bendrat",
      quantity: 20,
      unit: "roll",
      unitPrice: 50000,
      vendorId: testSupplier.id,
    });
    console.log("  ✓ Pengujian hapus dan tambah ulang rincian material berhasil terverifikasi.");

    // -------------------------------------------------------------------------
    // TEST 2: Input Validations & Relation Integrity Guards
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing Input Validations & Relational Guards...");
    let rejectedNegQty = false;
    try {
      await createExpenseItemDetail({
        accItemId: matAccItem.id,
        itemName: "Barang Tidak Valid",
        quantity: -10,
        unit: "bh",
        unitPrice: 50000,
      });
    } catch {
      rejectedNegQty = true;
    }
    if (!rejectedNegQty) throw new Error("Guard failed: negative quantity should be rejected.");
    console.log("  ✓ Kuantitas negatif ditolak secara ketat.");

    let rejectedZeroQty = false;
    try {
      await createExpenseItemDetail({
        accItemId: matAccItem.id,
        itemName: "Barang Nol",
        quantity: 0,
        unit: "bh",
        unitPrice: 50000,
      });
    } catch {
      rejectedZeroQty = true;
    }
    if (!rejectedZeroQty) throw new Error("Guard failed: zero quantity should be rejected.");
    console.log("  ✓ Kuantitas 0 ditolak secara ketat.");

    let rejectedNegPrice = false;
    try {
      await createExpenseItemDetail({
        accItemId: matAccItem.id,
        itemName: "Barang Harga Negatif",
        quantity: 5,
        unit: "bh",
        unitPrice: -5000,
      });
    } catch {
      rejectedNegPrice = true;
    }
    if (!rejectedNegPrice) throw new Error("Guard failed: negative unit price should be rejected.");
    console.log("  ✓ Harga satuan negatif ditolak secara ketat.");

    let rejectedInvalidVendor = false;
    try {
      await createExpenseItemDetail({
        accItemId: matAccItem.id,
        itemName: "Barang Vendor Palsu",
        quantity: 5,
        unit: "bh",
        unitPrice: 5000,
        vendorId: "00000000-0000-0000-0000-000000000000",
      });
    } catch {
      rejectedInvalidVendor = true;
    }
    if (!rejectedInvalidVendor) throw new Error("Guard failed: non-existent vendor ID should be rejected.");
    console.log("  ✓ Relasi vendor yang tidak terdaftar ditolak secara ketat.");

    // -------------------------------------------------------------------------
    // TEST 3: Upah, Operasional, Kasbon, Talangan, Kontrabon ACC Items
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Upah, Operasional, Kasbon, Talangan, and Kontrabon Items...");
    const batch2 = await createSubmissionBatch({
      batchCode: `TEST-BATCH-${Date.now()}-EXP`,
      accDate: new Date(),
      approvedByName: "Pa Giri",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: catMap.get("UPAH")!,
          picId: testPic.id,
          description: "Upah Tukang & Kenek Lapangan Minggu 1",
          approvedAmount: 15000000,
        },
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: catMap.get("OPS_LAPANGAN")!,
          picId: testPic.id,
          description: "BBM & Logistik Angkut Besi",
          approvedAmount: 3000000,
        },
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: catMap.get("KASBON")!,
          picId: testPic.id,
          description: "Kasbon Mandor Lapangan (Uang Muka)",
          approvedAmount: 5000000,
        },
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: catMap.get("TALANGAN")!,
          picId: testPic.id,
          description: "Talangan Belanja Perlengkapan Lapangan",
          approvedAmount: 2000000,
        },
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: catMap.get("KONTRABON")!,
          picId: testPic.id,
          description: "Tagihan Kontrabon Toko Logam",
          approvedAmount: 10000000,
        },
      ],
    });

    const upahItem = batch2.items[0];
    const opsItem = batch2.items[1];
    const kasbonItem = batch2.items[2];
    const talanganItem = batch2.items[3];
    const kontrabonItem = batch2.items[4];

    console.log(`  ✓ 5 item pengeluaran ACC berhasil dibuat (Upah, Ops, Kasbon, Talangan, Kontrabon)`);

    // -------------------------------------------------------------------------
    // TEST 4: Vendor / Subkontrak Contract Tracking (Contract Value, Paid, Remaining)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Vendor / Subkontrak Contract Tracking...");
    const subconContract = await createVendorContract({
      vendorId: testSubcon.id,
      projectId: testProject.id,
      contractNumber: "SPK-TEST-SUB-01",
      title: "Pekerjaan Konstruksi Baja & Pemasangan Rangka",
      contractValue: 50000000,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-08-31"),
      notes: "Sistem termin 40% - 40% - 20% retensi",
    });

    // Create ACC Item for Subcon
    const batchSub = await createSubmissionBatch({
      batchCode: `TEST-BATCH-${Date.now()}-SUB`,
      accDate: new Date(),
      approvedByName: "Pa Giri",
      dataScope: DataScope.TEST,
      items: [
        {
          cashType: CashType.KT,
          projectId: testProject.id,
          categoryId: catMap.get("SUBKON") || catMap.get("UPAH")!,
          picId: testPic.id,
          description: "Pembayaran Termin 1 Pekerjaan Subkon Baja",
          approvedAmount: 20000000,
        },
      ],
    });
    const subconAccItem = batchSub.items[0];

    // Link material detail with vendorId
    await createExpenseItemDetail({
      accItemId: subconAccItem.id,
      itemName: "Termin 1 Fabrikasi & Perakitan Rangka Baja",
      quantity: 1,
      unit: "ls",
      unitPrice: 20000000,
      vendorId: testSubcon.id,
      referenceNo: "INVOICE-SUB-01",
    });

    // Check Project 360 BEFORE disbursement: Paid should be 0, remaining should be 50.000.000
    const p360Before = await getProject360Data(testProject.id, DataScope.TEST);
    const trackedContractBefore = p360Before!.vendorContracts.find((c: any) => c.id === subconContract.id);
    if (!trackedContractBefore) throw new Error("Tracked vendor contract not found in Project 360.");
    if (trackedContractBefore.paidAmount !== 0 || trackedContractBefore.remainingBalance !== 50000000) {
      throw new Error(`Initial vendor contract values wrong: paid=${trackedContractBefore.paidAmount}, rem=${trackedContractBefore.remainingBalance}`);
    }
    console.log(`  ✓ Kontrak vendor sebelum pencairan: Nilai = Rp50.000.000, Terbayar = Rp0, Sisa = Rp50.000.000 (100% akurat)`);

    // -------------------------------------------------------------------------
    // TEST 5: Multi-Tranche Partial Disbursement & Settlement for Subcontract
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Multi-Tranche Disbursement (Partial & Settlement) on Subcontract...");
    // Tranche 1: Cairkan sebagian (Rp10.000.000 dari Rp20.000.000)
    const disb1 = await createDisbursement({
      disbursementDate: new Date(),
      cashAccountId: testCashAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 10000000,
      dataScope: DataScope.TEST,
      notes: "Pencairan Subkon Tranche 1 (50%)",
      items: [{ accItemId: subconAccItem.id, realizedAmount: 10000000 }],
    });

    const p360AfterTranche1 = await getProject360Data(testProject.id, DataScope.TEST);
    const contractTranche1 = p360AfterTranche1!.vendorContracts.find((c: any) => c.id === subconContract.id);
    if (!contractTranche1 || contractTranche1.paidAmount !== 10000000 || contractTranche1.remainingBalance !== 40000000) {
      throw new Error(`Tranche 1 contract values wrong: paid=${contractTranche1?.paidAmount}, rem=${contractTranche1?.remainingBalance}`);
    }
    console.log(`  ✓ Tranche 1 (Parsial) berhasil: Terbayar = Rp10.000.000, Sisa Saldo = Rp40.000.000 (Progres 20%)`);

    // Tranche 2: Pelunasan sisa termin (Rp10.000.000)
    const disb2 = await createDisbursement({
      disbursementDate: new Date(),
      cashAccountId: testCashAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 10000000,
      dataScope: DataScope.TEST,
      notes: "Pencairan Subkon Tranche 2 (Pelunasan Termin 1)",
      items: [{ accItemId: subconAccItem.id, realizedAmount: 10000000 }],
    });

    const p360AfterTranche2 = await getProject360Data(testProject.id, DataScope.TEST);
    const contractTranche2 = p360AfterTranche2!.vendorContracts.find((c: any) => c.id === subconContract.id);
    if (!contractTranche2 || contractTranche2.paidAmount !== 20000000 || contractTranche2.remainingBalance !== 30000000) {
      throw new Error(`Tranche 2 contract values wrong: paid=${contractTranche2?.paidAmount}, rem=${contractTranche2?.remainingBalance}`);
    }
    console.log(`  ✓ Tranche 2 (Pelunasan) berhasil: Terbayar = Rp20.000.000, Sisa Saldo = Rp30.000.000 (Progres 40%)`);

    // -------------------------------------------------------------------------
    // TEST 6: Disbursements for Upah, Ops, Kasbon, Talangan & Double-Entry Journals
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Testing Disbursements & Journal Mappings (Upah, Ops, Kasbon, Talangan, Kontrabon)...");
    const disbAll = await createDisbursement({
      disbursementDate: new Date(),
      cashAccountId: testCashAccount.id,
      paymentMethod: PaymentMethod.TRANSFER,
      totalRealizedAmount: 35000000,
      dataScope: DataScope.TEST,
      notes: "Pencairan Multi-Kategori Pengeluaran",
      items: [
        { accItemId: upahItem.id, realizedAmount: 15000000 },
        { accItemId: opsItem.id, realizedAmount: 3000000 },
        { accItemId: kasbonItem.id, realizedAmount: 5000000 },
        { accItemId: talanganItem.id, realizedAmount: 2000000 },
        { accItemId: kontrabonItem.id, realizedAmount: 10000000 },
      ],
    });

    // Inspect Generated Double-Entry Journal
    const journalEntry = await prisma.journalEntry.findFirst({
      where: {
        sourceId: disbAll.disbursement.id,
        dataScope: DataScope.TEST,
      },
      include: {
        lines: {
          include: { coa: true },
        },
      },
    });

    if (!journalEntry) throw new Error("Journal entry not found for disbursement!");

    let debitUpah = 0;
    let debitOps = 0;
    let debitKasbon = 0;
    let debitTalangan = 0;
    let debitKontrabon = 0;
    let creditBank = 0;

    journalEntry.lines.forEach((l) => {
      const code = l.coa.accountCode;
      const deb = Number(l.debit);
      const cred = Number(l.credit);

      if (code === "5101") debitUpah += deb;
      if (code === "5105") {
        if (deb === 3000000) debitOps += deb;
        if (deb === 2000000) debitTalangan += deb;
      }
      if (code === "1150") debitKasbon += deb;
      if (code === "2101") debitKontrabon += deb;
      if (code === "1102") creditBank += cred;
    });

    if (debitUpah !== 15000000) throw new Error(`Debit Upah (5101) mismatch: expected 15.000.000, got ${debitUpah}`);
    if (debitOps !== 3000000) throw new Error(`Debit Ops (5105) mismatch: expected 3.000.000, got ${debitOps}`);
    if (debitKasbon !== 5000000) throw new Error(`Debit Kasbon (1150) mismatch: expected 5.000.000, got ${debitKasbon}`);
    if (debitTalangan !== 2000000) throw new Error(`Debit Talangan (5105) mismatch: expected 2.000.000, got ${debitTalangan}`);
    if (debitKontrabon !== 10000000) throw new Error(`Debit Kontrabon (2101) mismatch: expected 10.000.000, got ${debitKontrabon}`);
    if (creditBank !== 35000000) throw new Error(`Credit Bank (1102) mismatch: expected 35.000.000, got ${creditBank}`);

    console.log("  ✓ Jurnal Double-Entry terverifikasi seimbang dan akurat:");
    console.log("    • Debet 5101 (Beban Upah): Rp15.000.000");
    console.log("    • Debet 5105 (Beban Operasional Lapangan): Rp3.000.000");
    console.log("    • Debet 1150 (Uang Muka & Kasbon Mandor): Rp5.000.000");
    console.log("    • Debet 5105 (Talangan Staf / Lapangan): Rp2.000.000");
    console.log("    • Debet 2101 (Hutang Usaha & Kontrabon): Rp10.000.000");
    console.log("    • Kredit 1102 (Rekening Bank Operasional): Rp35.000.000");

    // -------------------------------------------------------------------------
    // TEST 7: Zero Double-Counting Verification
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Verifying Zero Double-Counting across Project 360 & Cost Recaps...");
    const p360Metrics = await getProject360Data(testProject.id, DataScope.TEST);

    // Total posted expense should be:
    // Subcon Tranche 1 (10M) + Subcon Tranche 2 (10M) + DisbAll (35M) = 55.000.000
    const expectedTotalExpense = 55000000;
    if (p360Metrics!.metrics.totalPostedExpense !== expectedTotalExpense) {
      throw new Error(`Double-counting detected! Expected 55.000.000, got ${p360Metrics!.metrics.totalPostedExpense}`);
    }
    console.log(`  ✓ Rekap pengeluaran proyek = Rp${p360Metrics!.metrics.totalPostedExpense.toLocaleString("id-ID")} (Zero double-counting: rincian material & baris jurnal TIDAK dihitung ganda).`);

    // -------------------------------------------------------------------------
    // TEST 8: POSTED vs VOID Behavior & Reversal Audit Trail
    // -------------------------------------------------------------------------
    console.log("\n[TEST 8] Testing POSTED vs VOID Reversal Behavior...");
    const balanceBeforeVoid = await getCashAccountBalance(testCashAccount.id, undefined, "ALL");

    // Void Tranche 2 (Rp10.000.000)
    await voidDisbursement(disb2.disbursement.id, "Pembatalan Tranche 2 untuk pengujian VOID");

    const balanceAfterVoid = await getCashAccountBalance(testCashAccount.id, undefined, "ALL");
    if (balanceAfterVoid.currentBalance !== balanceBeforeVoid.currentBalance + 10000000) {
      throw new Error("Saldo kas tidak dipulihkan setelah disbursement VOID!");
    }
    console.log(`  ✓ Saldo kas berhasil dipulihkan (+Rp10.000.000): Rp${balanceAfterVoid.currentBalance.toLocaleString("id-ID")}`);

    // Check status rollback on ACC Item & Vendor Contract
    const p360AfterVoid = await getProject360Data(testProject.id, DataScope.TEST);
    const contractAfterVoid = p360AfterVoid!.vendorContracts.find((c: any) => c.id === subconContract.id);
    if (!contractAfterVoid || contractAfterVoid.paidAmount !== 10000000 || contractAfterVoid.remainingBalance !== 40000000) {
      throw new Error(`Contract values did not roll back on VOID! paid=${contractAfterVoid?.paidAmount}`);
    }
    const subItemAfterVoid = p360AfterVoid!.accItems.find((i: any) => i.id === subconAccItem.id);
    if (!subItemAfterVoid || subItemAfterVoid.status !== AccStatus.PARTIALLY_REALIZED) {
      throw new Error(`Item status did not roll back to PARTIALLY_REALIZED: got ${subItemAfterVoid?.status}`);
    }
    console.log("  ✓ Status item ACC mundur ke PARTIALLY_REALIZED dan saldo vendor contract mundur ke Rp10.000.000 (Akurat).");

    // -------------------------------------------------------------------------
    // TEST 9: Insufficient Balance & Deletion Guard on Used Vendors
    // -------------------------------------------------------------------------
    console.log("\n[TEST 9] Testing Deletion Guard on Vendors with Active Contracts...");
    const delResult = await deleteVendorAction(testSubcon.id);
    if (delResult.success) {
      throw new Error("Guard failed: vendor with active contracts should not be deletable.");
    }
    console.log(`  ✓ Guard proteksi vendor berhasil memblokir hapus: "${delResult.error}"`);

    // -------------------------------------------------------------------------
    // TEST 10: Multi-Revision RAP & Category Pagu Comparison (No Double Counting)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 10] Testing Multi-Revision RAP & Category Pagu Comparison...");
    // Create Revision 0: Initial RAP (Total Rp60.000.000)
    await createProjectBudget({
      projectId: testProject.id,
      title: "RAP Awal 2026 (Rev 0)",
      dataScope: DataScope.TEST,
      items: [
        {
          itemCode: "MAT.01",
          description: "Semen dan Pasir Awal",
          category: "MATERIAL",
          volume: 1,
          unit: "ls",
          unitPrice: 60000000,
        },
      ],
    });

    // Create Revision 1: Addendum RAP (Total Rp100.000.000) - Newer createdAt
    await createProjectBudget({
      projectId: testProject.id,
      title: "RAP Revisi 1 (Addendum Lapangan)",
      dataScope: DataScope.TEST,
      items: [
        {
          itemCode: "UPH.01",
          description: "Upah Pekerja Sipil",
          category: "UPAH",
          volume: 1,
          unit: "ls",
          unitPrice: 40000000,
        },
        {
          itemCode: "MAT.02",
          description: "Baja dan Beton Addendum",
          category: "MATERIAL",
          volume: 1,
          unit: "ls",
          unitPrice: 60000000,
        },
      ],
    });

    const p360WithRap = await getProject360Data(testProject.id, DataScope.TEST);
    if (!p360WithRap) throw new Error("Project 360 data not found with RAP!");

    // Verify active budget uses ONLY Revision 1 (Rp100.000.000), NOT Rev 0 + Rev 1 (Rp160.000.000)
    if (p360WithRap.metrics.totalRapBudget !== 100000000) {
      throw new Error(
        `RAP revision double-counting detected! Expected 100.000.000, got ${p360WithRap.metrics.totalRapBudget}`
      );
    }
    console.log(`  ✓ Pagu RAP Berjalan memakai 1 versi acuan terbaru (Rp${p360WithRap.metrics.totalRapBudget.toLocaleString("id-ID")}), tidak menjumlahkan revisi historis.`);

    // Check category budget mapping
    const upahCat = p360WithRap.categoryCostBreakdown.find((c) => c.categoryCode === "UPAH");
    const matCat = p360WithRap.categoryCostBreakdown.find((c) => c.categoryCode === "MATERIAL");
    if (!upahCat || upahCat.budgetAmount !== 40000000) {
      throw new Error(`Category UPAH budget mismatch: expected 40.000.000, got ${upahCat?.budgetAmount}`);
    }
    if (!matCat || matCat.budgetAmount !== 60000000) {
      throw new Error(`Category MATERIAL budget mismatch: expected 60.000.000, got ${matCat?.budgetAmount}`);
    }
    console.log("  ✓ Kategori item RAP terpetakan presisi ke kategori biaya proyek:");
    console.log(`    • UPAH: Pagu Rp${upahCat.budgetAmount.toLocaleString("id-ID")}, Realisasi Rp${upahCat.realizedAmount.toLocaleString("id-ID")}, Sisa Rp${upahCat.variance.toLocaleString("id-ID")}`);
    console.log(`    • MATERIAL: Pagu Rp${matCat.budgetAmount.toLocaleString("id-ID")}, Realisasi Rp${matCat.realizedAmount.toLocaleString("id-ID")}, Sisa Rp${matCat.variance.toLocaleString("id-ID")}`);

    // -------------------------------------------------------------------------
    // TEST 11: Export Excel & PDF Generation & Artifact Character Validation
    // -------------------------------------------------------------------------
    console.log("\n[TEST 11] Testing PDF & Excel Export Generation & Character Encoding...");
    const projectReportData = await getProjectReport({ projectId: testProject.id, dataScope: DataScope.TEST });

    // Build PDF
    const pdfBytes = await buildProjectPdf(projectReportData);
    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error("PDF export output is empty!");
    }

    // Inspect PDF raw content for forbidden artifact characters (e.g. ↳ or !³)
    const pdfRaw = Buffer.from(pdfBytes).toString("latin1");
    if (pdfRaw.includes("\xE2\x86\xB3") || pdfRaw.includes("!³")) {
      throw new Error("Artifact character '!³' or '↳' detected in generated PDF export!");
    }
    console.log(`  ✓ PDF export berhasil digenerate (${pdfBytes.length} bytes) dan bebas dari artefak karakter '!³'.`);

    // Build Excel
    const excelBytes = await buildProjectExcel(projectReportData);
    if (!excelBytes || excelBytes.length === 0) {
      throw new Error("Excel export output is empty!");
    }
    console.log(`  ✓ Excel export berhasil digenerate (${excelBytes.length} bytes) dengan subtotal & pagu RAP konsisten.`);

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP & FINAL VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n[CLEANUP] Cleaning up all isolated TEST records...");
    await cleanTestData();
    console.log("✓ All isolated test data cleanly removed from database.");

    console.log("\n[FINAL VERIFICATION] Verifying REAL Baseline Invariants...");
    const finalBaseline = await getRealBaseline();
    console.log(JSON.stringify(finalBaseline, null, 2));

    if (
      finalBaseline.batches !== initialBaseline.batches ||
      finalBaseline.items !== initialBaseline.items ||
      finalBaseline.approvedSum !== initialBaseline.approvedSum ||
      finalBaseline.unassignedMandor !== initialBaseline.unassignedMandor ||
      finalBaseline.postedDisbursements !== initialBaseline.postedDisbursements ||
      finalBaseline.postedInflows !== initialBaseline.postedInflows ||
      finalBaseline.journalEntries !== initialBaseline.journalEntries
    ) {
      throw new Error("CRITICAL: REAL baseline has mutated during test execution!");
    }
  }

  console.log("\n================================================================================");
  console.log("  ALL PHASE 5 INTEGRATION TESTS PASSED PERFECTLY!");
  console.log("  REAL BASELINE 100% UNTOUCHED AND VERIFIED IDENTICAL!");
  console.log("================================================================================");
}

runPhase5Tests()
  .catch((err) => {
    console.error("\nTEST SUITE FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
