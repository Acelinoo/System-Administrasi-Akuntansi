# Phase 2A — Master Data Enrichment

## 1. Changes Made
Dalam Fase 2A, ProTrack diperkaya dengan master data awal untuk mendukung administrasi berbasis proyek tanpa mengubah atau mengganggu Financial Core yang bersifat **IMMUTABLE**:
1. **Master Project Enrichment**: Menambahkan field kontraktual dan operasional (`clientName`, `contractValue`, `targetStartDate`, `targetEndDate`).
2. **Master Vendor Creation**: Menambahkan entitas baru `Vendor` beserta enum `VendorType` (`SUPPLIER`, `SUBCONTRACTOR`, `SERVICE`) untuk merepresentasikan rekanan pengadaan material, subkontraktor, dan vendor jasa yang dapat digunakan lintas proyek.
3. **Project ↔ FundInflow Relation**: Menambahkan atribusi opsional `projectId` pada penerimaan kas masuk (`FundInflow`) sehingga penerimaan dana dapat diatribusikan ke proyek tertentu tanpa mengubah formula saldo kas atau double-entry ledger.
4. **Non-Destructive DDL Migration**: Mengimplementasikan migrasi database additif melalui `prisma/migrations/20261008154500_enrich_project_and_vendor/migration.sql` tanpa kehilangan satu byte data historis.
5. **UI & Server Action Updates**: Menambahkan form dan modal edit pada Master Proyek, membuat halaman manajemen Master Vendor (`/master/vendors`), menambahkan menu navigasi sidebar & tab master, serta menyediakan dropdown pilihan proyek pada formulir penerimaan dana.
6. **Automated Testing Suite**: Menambahkan `tests/phase2a-master-enrichment.ts` dengan 16 assertion checks dan memverifikasi seluruh 10 test suite finansial terdahulu tetap 100% PASS.

---

## 2. Project Model Changes
Model `Project` pada `prisma/schema.prisma` diperkaya dengan empat kolom baru yang seluruhnya bersifat **nullable / default-safe**:
- `clientName` (`VARCHAR(150)`, nullable): Nama pemilik proyek atau instansi pemberi kerja.
- `contractValue` (`DECIMAL(15, 2)`, nullable): Nilai nominal kontrak kerja induk proyek.
- `targetStartDate` (`DATE`, nullable): Target tanggal mulai pelaksanaan fisik proyek.
- `targetEndDate` (`DATE`, nullable): Target tanggal penyelesaian pelaksanaan proyek.
- Relasi balik: `fundInflows FundInflow[]`.

Field progress atau RAP **tidak** dibuat pada model ini sesuai batasan ketat fase 2A (progress dan RAP akan dialokasikan pada entitas terpisah di fase berikutnya).

---

## 3. Vendor Model
Entitas baru `Vendor` ditambahkan ke `prisma/schema.prisma` dan dipetakan ke tabel database `vendors`:
```prisma
enum VendorType {
  SUPPLIER
  SUBCONTRACTOR
  SERVICE
}

model Vendor {
  id        String     @id @default(uuid()) @db.Uuid
  code      String?    @unique @db.VarChar(30)
  name      String     @db.VarChar(150)
  type      VendorType @default(SUPPLIER)
  phone     String?    @db.VarChar(30)
  address   String?    @db.Text
  notes     String?    @db.Text
  isActive  Boolean    @default(true)
  createdAt DateTime   @default(now()) @db.Timestamptz()
  updatedAt DateTime   @updatedAt @db.Timestamptz()

  @@map("vendors")
}
```
Karakteristik Vendor:
- Mewakili 3 tipe utama: `SUPPLIER` (pemasok material/bahan), `SUBCONTRACTOR` (mandor/subkontraktor borongan), dan `SERVICE` (penyedia jasa/sewa alat/survey).
- Dapat digunakan lintas proyek.
- Mendukung kode unik opsional, status aktif/nonaktif, dan audit timestamps.

---

## 4. FundInflow Project Relation
Tabel `fund_inflows` diperkaya dengan kolom foreign key opsional:
- Kolom: `projectId UUID NULL`
- Foreign Key: `CONSTRAINT fund_inflows_projectId_fkey FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE`
- Index: `@@index([projectId])`

**Invarian Finansial**:
- `FundInflow` tetap mencerminkan **KAS RIIL YANG BENAR-BENAR MASUK**.
- Tidak diubah menjadi piutang, tagihan, atau estimasi termin.
- Jika `projectId == null`: Transaksi dicatat sebagai drop dana kas masuk umum (operasional kantor/manajemen).
- Jika `projectId != null`: Transaksi diatribusikan ke proyek yang bersangkutan.
- Formula saldo kas pada `src/lib/finance/balance.service.ts` tetap memproses seluruh penerimaan `POSTED` tanpa filtering proyek, sehingga saldo kas dan integritas jurnal double-entry **100% identik dan tidak berubah**.

---

## 5. Migration Safety
Migrasi database diterapkan melalui skrip SQL murni non-destruktif (`prisma/migrations/20261008154500_enrich_project_and_vendor/migration.sql`):
1. **Zero Data Loss**: Tidak ada tabel atau kolom yang di-drop.
2. **Backward-Compatibility**: Semua kolom baru (`clientName`, `contractValue`, `targetStartDate`, `targetEndDate`, `projectId`) bersifat `NULLABLE`.
3. **Foreign Key Integrity**: `ON DELETE SET NULL` memastikan jika entitas proyek dihapus, catatan kas masuk historis tidak akan hilang.
4. **Database Executed**: Dieksekusi secara aman menggunakan `prisma db execute` pada Neon PostgreSQL production.

---

## 6. Validation
Validasi Zod dan Server Actions:
- `src/lib/validation/inflow.schema.ts`:
  - `projectId: z.string().uuid().optional().nullable()`
- `src/lib/finance/inflow.service.ts`:
  - Memverifikasi keberadaan `project` jika `projectId` diberikan.
  - Menyimpan `projectId` ke database.
- `src/app/actions/master.actions.ts`:
  - `createProjectAction` & `updateProjectAction` memvalidasi parsing nilai kontrak `Decimal/number` dan konversi tanggal target `Date/null`.
  - `createVendorAction` & `updateVendorAction` memvalidasi kelengkapan nama vendor dan enum `VendorType`.
  - `toggleVendorStatusAction` & `deleteVendorAction` melindungi integritas data vendor.

---

## 7. UI Changes
1. **Master Proyek (`/master/projects`)**:
   - Menampilkan kolom Owner/Klien, Nilai Kontrak, Target Periode, dan jumlah transaksi ACC + Inflow.
   - Form modal "Tambah Proyek Baru" diperkaya input Owner/Klien, Nilai Kontrak, Target Mulai, Target Selesai.
   - Ditambahkan modal "Edit Proyek" untuk memperbarui data proyek yang sudah ada.
2. **Master Vendor (`/master/vendors`)**:
   - Dibuat halaman baru `/master/vendors` dengan komponen interaktif `VendorsManager.tsx`.
   - Fitur: Quick stats cards (Total, Supplier, Subkon, Jasa), search bar instan, filter tipe vendor, filter status aktif/nonaktif.
   - Modal "Tambah Vendor Baru" dan modal "Edit Vendor".
   - Tombol toggle aktif/nonaktif.
3. **Master Navigation & Sidebar**:
   - Ditambahkan tab navigasi "Vendor & Subkon" pada `/master/layout.tsx`.
   - Ditambahkan menu "Vendor" di bawah grup MASTER DATA pada sidebar aplikasi.
4. **Penerimaan Dana (`/inflows`)**:
   - Modal pencatatan dana masuk (`InflowFormDialog.tsx`) memiliki dropdown opsional `Alokasi Proyek (Opsional)`.
   - Tabel daftar penerimaan dana menampilkan badge kode proyek yang bersangkutan atau label `Umum` jika tanpa kaitan proyek.

---

## 8. Tests
Pengujian komprehensif dilakukan pada `tests/phase2a-master-enrichment.ts` yang mencakup 10 skenario:
1. `Existing project tanpa data baru tetap valid`: PASS
2. `Project dengan owner/client valid`: PASS
3. `Project dengan contract value valid`: PASS
4. `Project dengan target dates valid`: PASS
5. `Vendor creation untuk SUPPLIER, SUBCONTRACTOR, SERVICE`: PASS
6. `Vendor inactive toggle`: PASS
7. `Vendor deletion / preservation safety check`: PASS
8. `FundInflow tanpa project tetap valid`: PASS
9. `FundInflow dengan project tetap valid`: PASS
10. `FundInflow project relation tidak mengubah cash calculation`: PASS

Semua 16 assertion checks dinyatakan **16/16 PASSED, 0 FAILED**.
Seluruh 10 test suite finansial sebelumnya (`npm test`) dieksekusi dan dinyatakan **100% PASSED**.

---

## 9. Financial Core Verification
Invarian finansial baseline diverifikasi tidak mengalami perubahan nominal, status, atau saldo:
- **REAL Batches**: 379 batches (Tetap)
- **REAL Items**: 1.028 items (Tetap)
- **REAL Approved Total**: Rp4.303.052.418 (Tetap)
- **REAL Posted Disbursements**: Rp0 (Tetap)
- **REAL Posted Inflows**: Rp0 (Tetap)
- **REAL Active Journals**: 0 entries (Tetap)
- **Holding States**:
  - Kandidat realisasi Rp34.299.517 tetap tertahan di DB.
  - 723 item UNASSIGNED_MANDOR tetap terjaga.
  - 6 kandidat proyek dengan `confirmationStatus = REQUIRES_BUSINESS_CONFIRMATION` tetap terisolasi.

---

## 10. Files Changed
- `prisma/schema.prisma`: Penambahan `VendorType`, `model Vendor`, enrichment pada `Project`, dan relasi `FundInflow.projectId`.
- `prisma/migrations/20261008154500_enrich_project_and_vendor/migration.sql`: Skrip DDL non-destruktif.
- `src/lib/validation/inflow.schema.ts`: Penambahan field `projectId` Zod validation.
- `src/lib/finance/inflow.service.ts`: Penanganan `projectId` dan verifikasi keberadaan proyek.
- `src/app/actions/inflow.actions.ts`: Fetching relasi proyek dan penanganan parameter proyek pada action.
- `src/app/actions/master.actions.ts`: Enrichment action proyek dan penambahan CRUD server actions master vendor.
- `src/app/master/projects/ProjectsManager.tsx`: Enrichment tabel dan penambahan modal add/edit dengan field kontrak & target.
- `src/app/master/vendors/page.tsx`: Halaman server component master vendor.
- `src/app/master/vendors/VendorsManager.tsx`: Komponen client manajemen master vendor.
- `src/app/master/layout.tsx`: Penambahan tab navigasi master vendor.
- `src/app/components/Sidebar.tsx`: Penambahan menu vendor di sidebar.
- `src/app/inflows/InflowFormDialog.tsx`: Dropdown opsional alokasi proyek.
- `src/app/inflows/page.tsx`: Fetching proyek aktif dan kolom Proyek pada tabel data.
- `package.json`: Penambahan `tests/phase2a-master-enrichment.ts` ke test script.
- `tests/phase2a-master-enrichment.ts`: Automated test suite untuk Phase 2A.
- `docs/PHASE-2A-MASTER-DATA.md`: Dokumentasi resmi Fase 2A.

---

## 11. Known Limitations
- RAP (Rencana Anggaran Biaya Pelaksanaan) belum dibuat pada fase ini (direncanakan untuk Fase 2B).
- Progress fisik/volume lapangan belum dibuat pada fase ini (direncanakan untuk Fase 2C).
- Kontrak detail vendor, invoice vendor, dan hutang/pembayaran termin vendor belum dibuat pada fase ini.
- Master Vendor saat ini belum dihubungkan sebagai foreign key pada pengeluaran ACC atau disbursement item (akan diintegrasikan pada fase transaksi operasional lanjutan).
