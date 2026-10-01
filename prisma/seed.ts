import { PrismaClient, AccountType, CoaType, NormalBalance, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding master data...");

  // 1. Default User
  const defaultUser = await prisma.user.upsert({
    where: { username: "nisa" },
    update: {},
    create: {
      username: "nisa",
      fullName: "Khairunnisa (Staf Keuangan)",
      role: UserRole.STAFF,
      isActive: true,
    },
  });
  console.log("Default user created:", defaultUser.username);

  // 2. Master Field PICs
  const pics = [
    { name: "PA HERI", roleTitle: "Koordinator Lapangan / Mandor" },
    { name: "PA DEDI", roleTitle: "Logistik & Operasional Lapangan" },
    { name: "PA MAMAT", roleTitle: "Mandor Sipil & Interior" },
    { name: "NISA", roleTitle: "Staf Administrasi & Keuangan" },
    { name: "PA UDEN", roleTitle: "Koordinator Lapangan" },
    { name: "PA ENGKUS", roleTitle: "Koordinator Lapangan" },
    { name: "PA AGUS", roleTitle: "Mandor Borongan Sipil" },
  ];

  for (const pic of pics) {
    await prisma.fieldPic.upsert({
      where: { name: pic.name },
      update: { roleTitle: pic.roleTitle },
      create: { name: pic.name, roleTitle: pic.roleTitle, isActive: true },
    });
  }
  console.log("Field PICs seeded.");

  // 3. Master Cash & Bank Accounts (Opening balances set to 0.00 - NOT real figures)
  const cashAccounts = [
    { code: "KAS_NISA", name: "Kas Besar (Nisa)", type: AccountType.CASH },
    { code: "KAS_BRANKAS", name: "Kas Besar (Brankas)", type: AccountType.CASH },
    { code: "MANDIRI_AJ", name: "Mandiri Akhmad Jaelani", type: AccountType.BANK, bankName: "Bank Mandiri" },
    { code: "MANDIRI_CBS", name: "Mandiri CBS", type: AccountType.BANK, bankName: "Bank Mandiri" },
    { code: "BJB_CBS", name: "BJB CBS", type: AccountType.BANK, bankName: "Bank BJB" },
    { code: "BJB_CRS", name: "BJB CRS", type: AccountType.BANK, bankName: "Bank BJB" },
    { code: "BRI_CRS", name: "BRI CRS", type: AccountType.BANK, bankName: "Bank BRI" },
  ];

  for (const acc of cashAccounts) {
    await prisma.cashAccount.upsert({
      where: { accountCode: acc.code },
      update: { accountName: acc.name, accountType: acc.type },
      create: {
        accountCode: acc.code,
        accountName: acc.name,
        accountType: acc.type,
        bankName: acc.bankName || null,
        openingBalance: 0,
        isActive: true,
      },
    });
  }
  console.log("Cash & Bank accounts seeded.");

  // 4. Master Projects & Sub-units
  const projectsData = [
    {
      code: "ALCENT",
      name: "Proyek Al-Cent (Al-Azhar Center)",
      subUnits: [
        { code: "SMP", name: "Alcent SMP" },
        { code: "SMA", name: "Alcent SMA" },
        { code: "SD_TK", name: "Alcent SD & TK" },
      ],
    },
    {
      code: "SUMEDANG",
      name: "Proyek Sumedang",
      subUnits: [
        { code: "SIPIL", name: "Pekerjaan Struktur & Sipil" },
        { code: "BAJA", name: "Pekerjaan Konstruksi Baja" },
        { code: "ME", name: "Pekerjaan Elektrikal & ME" },
        { code: "FASILITAS", name: "Fasilitas & Lapangan" },
      ],
    },
    {
      code: "KAWALUYAAN",
      name: "Proyek Kawaluyaan",
      subUnits: [
        { code: "BANGUNAN", name: "Pekerjaan Bangunan Kawaluyaan" },
      ],
    },
    {
      code: "RT_BU_ANI",
      name: "Rumah Tinggal Bu Ani",
      subUnits: [
        { code: "RENOVASI", name: "Renovasi Rumah Bu Ani" },
      ],
    },
    {
      code: "TANGGERANG",
      name: "Proyek Tanggerang",
      subUnits: [
        { code: "INTERIOR", name: "Pekerjaan Interior & Sipil" },
      ],
    },
    {
      code: "INTERNAL",
      name: "Operasional Internal Kantor",
      subUnits: [
        { code: "RUTIN", name: "Kebutuhan Rutin & Utilitas" },
        { code: "KONSULTAN", name: "Operasional Tim Konsultan" },
      ],
    },
  ];

  for (const p of projectsData) {
    const project = await prisma.project.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: { code: p.code, name: p.name, isActive: true },
    });

    for (const sub of p.subUnits) {
      await prisma.projectSubUnit.upsert({
        where: {
          projectId_code: {
            projectId: project.id,
            code: sub.code,
          },
        },
        update: { name: sub.name },
        create: {
          projectId: project.id,
          code: sub.code,
          name: sub.name,
          isActive: true,
        },
      });
    }
  }
  console.log("Projects and Sub-units seeded.");

  // 5. Master Expense Categories & Sub-categories
  const categoriesData = [
    {
      code: "UPAH",
      name: "Upah & Tenaga Kerja",
      subCategories: [
        { code: "UPAH_TUKANG", name: "Upah Tukang Harian" },
        { code: "UPAH_MANDOR", name: "Upah Mandor / PIC" },
        { code: "LEMBURAN", name: "Upah Lembur" },
        { code: "KEROHIMAN", name: "Kerohiman / Kompensasi" },
      ],
    },
    {
      code: "MATERIAL",
      name: "Material & Bahan Bangunan",
      subCategories: [
        { code: "POKOK", name: "Material Pokok (Semen, Besi, Pasir)" },
        { code: "FINISHING", name: "Finishing (Cat, Wallpaper, Kaca)" },
        { code: "SANITAIR", name: "Sanitair & Plumbing" },
        { code: "ELEKTRIKAL", name: "Elektrikal (Lampu, Kabel, Pipa AC)" },
        { code: "ALAT_BANTU", name: "Alat Bantu & Habis Pakai" },
      ],
    },
    {
      code: "KONTRABON",
      name: "Kontrabon & Vendor Toko",
      subCategories: [
        { code: "RESTULOGAM", name: "Kontrabon Toko Logam / Besi" },
        { code: "TOKO_BANGUNAN", name: "Kontrabon Toko Material Umum" },
      ],
    },
    {
      code: "SUBKON",
      name: "Subkontraktor & Pekerjaan Spesialis",
      subCategories: [
        { code: "RAILING", name: "Pekerjaan Railing & Besi" },
        { code: "GYPSUM", name: "Pekerjaan Plafon & Partisi Gypsum" },
        { code: "ALUMINIUM", name: "Pekerjaan Aluminium & Kusen" },
      ],
    },
    {
      code: "SEWA_ALAT",
      name: "Sewa Peralatan & Mesin",
      subCategories: [
        { code: "SCAFFOLDING", name: "Sewa Scaffolding & Catwalk" },
        { code: "PERPANJANGAN", name: "Perpanjangan Sewa Alat" },
      ],
    },
    {
      code: "OPS_LAPANGAN",
      name: "Operasional Lapangan & Logistik",
      subCategories: [
        { code: "BBM_TOL", name: "BBM, E-toll & Parkir Angkut Material" },
        { code: "KEAMANAN", name: "Koordinasi Lingkungan / Satpam / Babinsa" },
        { code: "MESS_PEKERJA", name: "Sewa Kontrakan / Mess Pekerja" },
        { code: "LOGISTIK_TUKANG", name: "Air Minum, Konsumsi & Kebersihan" },
      ],
    },
    {
      code: "OPS_KANTOR",
      name: "Operasional Kantor (KU)",
      subCategories: [
        { code: "UTILITAS", name: "Listrik, Air & Telepon/Internet" },
        { code: "BPJS", name: "BPJS TK & Kesehatan" },
        { code: "ATK_PERLENGKAPAN", name: "ATK, Cetak Pengajuan, Materai" },
        { code: "RUTIN_KANTOR", name: "Iuran Lingkungan & Kebutuhan Kantor" },
      ],
    },
    {
      code: "KASBON",
      name: "Kasbon & Uang Muka Mandor",
      subCategories: [
        { code: "KASBON_MANDOR", name: "Kasbon Berkala Mandor/Tukang" },
        { code: "KASBON_OPERASIONAL", name: "Kasbon Operasional Mandor" },
      ],
    },
    {
      code: "TALANGAN",
      name: "Talangan & Reimbursement",
      subCategories: [
        { code: "REIMBURSE_MANDOR", name: "Talangan Belanja Lapangan Mandor" },
      ],
    },
  ];

  for (const cat of categoriesData) {
    const category = await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name },
      create: { code: cat.code, name: cat.name, isActive: true },
    });

    for (const sub of cat.subCategories) {
      await prisma.expenseSubCategory.upsert({
        where: {
          categoryId_code: {
            categoryId: category.id,
            code: sub.code,
          },
        },
        update: { name: sub.name },
        create: {
          categoryId: category.id,
          code: sub.code,
          name: sub.name,
          isActive: true,
        },
      });
    }
  }
  console.log("Categories and Sub-categories seeded.");

  // 6. Master Chart of Accounts (COA - Template Konfigurasi Standar, bukan fakta mutlak perusahaan)
  const coaData = [
    { code: "1101", name: "Kas Kecil & Kas Lapangan", type: CoaType.ASSET, balance: NormalBalance.DEBIT },
    { code: "1102", name: "Rekening Operasional Bank", type: CoaType.ASSET, balance: NormalBalance.DEBIT },
    { code: "1150", name: "Uang Muka & Kasbon Mandor/Tukang", type: CoaType.ASSET, balance: NormalBalance.DEBIT },
    { code: "2101", name: "Hutang Usaha & Kontrabon Vendor", type: CoaType.LIABILITY, balance: NormalBalance.CREDIT },
    { code: "3101", name: "Modal Operasional / Dropping Dana Atasan", type: CoaType.EQUITY, balance: NormalBalance.CREDIT },
    { code: "5101", name: "Beban Pokok Proyek - Upah", type: CoaType.EXPENSE, balance: NormalBalance.DEBIT },
    { code: "5102", name: "Beban Pokok Proyek - Material", type: CoaType.EXPENSE, balance: NormalBalance.DEBIT },
    { code: "5103", name: "Beban Pokok Proyek - Subkontraktor", type: CoaType.EXPENSE, balance: NormalBalance.DEBIT },
    { code: "5104", name: "Beban Pokok Proyek - Sewa Alat", type: CoaType.EXPENSE, balance: NormalBalance.DEBIT },
    { code: "5105", name: "Beban Operasional Lapangan & Logistik", type: CoaType.EXPENSE, balance: NormalBalance.DEBIT },
    { code: "6101", name: "Beban Operasional & Administrasi Umum", type: CoaType.EXPENSE, balance: NormalBalance.DEBIT },
  ];

  for (const coa of coaData) {
    await prisma.coaAccount.upsert({
      where: { accountCode: coa.code },
      update: { accountName: coa.name, accountType: coa.type, normalBalance: coa.balance },
      create: {
        accountCode: coa.code,
        accountName: coa.name,
        accountType: coa.type,
        normalBalance: coa.balance,
        isActive: true,
      },
    });
  }
  console.log("Chart of Accounts seeded.");

  // 7. Default Configurable Category -> COA Mapping
  const upahCat = await prisma.expenseCategory.findUnique({ where: { code: "UPAH" } });
  const matCat = await prisma.expenseCategory.findUnique({ where: { code: "MATERIAL" } });
  const subkonCat = await prisma.expenseCategory.findUnique({ where: { code: "SUBKON" } });
  const sewaCat = await prisma.expenseCategory.findUnique({ where: { code: "SEWA_ALAT" } });
  const opsLapCat = await prisma.expenseCategory.findUnique({ where: { code: "OPS_LAPANGAN" } });
  const opsKantorCat = await prisma.expenseCategory.findUnique({ where: { code: "OPS_KANTOR" } });
  const kasbonCat = await prisma.expenseCategory.findUnique({ where: { code: "KASBON" } });
  const kontrabonCat = await prisma.expenseCategory.findUnique({ where: { code: "KONTRABON" } });

  const coa5101 = await prisma.coaAccount.findUnique({ where: { accountCode: "5101" } });
  const coa5102 = await prisma.coaAccount.findUnique({ where: { accountCode: "5102" } });
  const coa5103 = await prisma.coaAccount.findUnique({ where: { accountCode: "5103" } });
  const coa5104 = await prisma.coaAccount.findUnique({ where: { accountCode: "5104" } });
  const coa5105 = await prisma.coaAccount.findUnique({ where: { accountCode: "5105" } });
  const coa6101 = await prisma.coaAccount.findUnique({ where: { accountCode: "6101" } });
  const coa1150 = await prisma.coaAccount.findUnique({ where: { accountCode: "1150" } });
  const coa2101 = await prisma.coaAccount.findUnique({ where: { accountCode: "2101" } });

  const mappings = [
    { cat: upahCat, coa: coa5101 },
    { cat: matCat, coa: coa5102 },
    { cat: subkonCat, coa: coa5103 },
    { cat: sewaCat, coa: coa5104 },
    { cat: opsLapCat, coa: coa5105 },
    { cat: opsKantorCat, coa: coa6101 },
    { cat: kasbonCat, coa: coa1150 },
    { cat: kontrabonCat, coa: coa2101 },
  ];

  for (const m of mappings) {
    if (m.cat && m.coa) {
      const existing = await prisma.categoryCoaMapping.findFirst({
        where: {
          categoryId: m.cat.id,
          subCategoryId: null,
        },
      });

      if (existing) {
        await prisma.categoryCoaMapping.update({
          where: { id: existing.id },
          data: { debitCoaId: m.coa.id },
        });
      } else {
        await prisma.categoryCoaMapping.create({
          data: {
            categoryId: m.cat.id,
            subCategoryId: null,
            debitCoaId: m.coa.id,
            isActive: true,
          },
        });
      }
    }
  }
  console.log("Category to COA mappings seeded.");

  console.log("Master seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
