# ProTrack — Project Administration & Reporting System

**ProTrack** adalah sistem administrasi dan pelaporan keuangan proyek internal yang dirancang khusus untuk staf/admin keuangan lapangan dalam mencatat alokasi pengajuan ACC dari atasan, drop dana masuk, realisasi pencairan ke PIC lapangan, pembukuan jurnal otomatis, dan pelaporan keuangan terpadu.

---

## 1. Tujuan Sistem

1. **Pencatatan Presisi**: Mencatat seluruh data pengajuan ACC yang disetujui atasan di luar sistem secara cepat, aman, dan tanpa duplikasi.
2. **Pengendalian Likuiditas**: Menjaga integritas saldo kas dan bank dengan mencegah overpayment dan saldo negatif (*Insufficient Funds Protection*).
3. **Pencairan Bertahap (*Multi-Tranche / Partial Payment*)**: Memungkinkan satu nomor kas ACC dicairkan bertahap hingga lunas dengan kalkulasi sisa *outstanding* secara real-time.
4. **Audit Trail Akuntansi (*Double-Entry GL*)**: Setiap mutasi pencairan dan penerimaan dana secara otomatis menghasilkan ayat jurnal umum yang selalu seimbang (*Debit === Credit*).
5. **Pelaporan & Export Komprehensif**: Menyediakan 6 modul laporan operasional dengan filter interaktif dan export instan ke format **Microsoft Excel (`.xlsx`)** dan **Dokumen PDF (`.pdf`)**.

> [!IMPORTANT]
> **Batasan Sistem ProTrack**:
> - ProTrack **bukan sistem approval atasan**. Atasan menyetujui pengajuan di luar sistem (WhatsApp/memo fisik/verbal).
> - Staf admin menginput data yang telah di-ACC sebagai pagu (*ceiling*) pengeluaran resmi.

---

## 2. Alur Kerja Utama (*Core Workflow*)

```text
ATASAN APPROVE DI LUAR SISTEM (Memo/WA/Verbal)
   │
   ▼
[1. STAFF INPUT DATA ACC] ──► Generate No Kas Unik (KU/KT) & Set Plafon Approved
   │
   ▼
[2. DROP DANA MASUK]     ──► Catat Inflow Kas/Bank ──► Jurnal Kas Masuk ──► Saldo Bertambah
   │
   ▼
[3. REALISASI / PENCAIRAN]──► Validasi Saldo & Pagu ──► Partial/Full Payment ──► Jurnal Beban
   │
   ▼
[4. MONITORING PIC & PROYEK] ──► Tracking Outstanding, Serapan Anggaran, dan Rekap PIC
   │
   ▼
[5. LAPORAN & EXPORT]    ──► Filter Periode/Proyek/PIC ──► Download Excel / Cetak PDF
```

---

## 3. Struktur Modul Aplikasi

| Modul | Rute URL | Deskripsi Fungsi |
|---|---|---|
| **Dashboard** | `/` | Ringkasan 5 metrik finansial utama (Total ACC, Realisasi, Outstanding, Inflow, Saldo Kas/Bank) dan monitoring real-time (ACC terbaru, pencairan terbaru, outstanding terbesar, saldo akun). |
| **Pengajuan ACC** | `/acc`, `/acc/new`, `/acc/[id]` | Daftar pengajuan ACC, form input batch multi-item dinamis dengan auto-numbering No Kas (`KT.26.xxx` / `KU.26.xxx`), dan detail alokasi per item. |
| **Penerimaan Dana** | `/inflows` | Pencatatan drop dana dari manajemen/kantor pusat, mutasi penambahan saldo kas/bank, dan pembatalan (*VOID*). |
| **Pencairan Dana** | `/disbursements`, `/disbursements/new`, `/disbursements/[id]` | Pencatatan voucher pengeluaran dana ke PIC, seleksi item ACC outstanding, validasi saldo cukup, kalkulasi sisa hutang, dan aksi *VOID*. |
| **Distribusi PIC** | `/pic` | Monitoring serapan dana dan beban tanggungan per penanggung jawab lapangan (mandor/kepala pelaksana). |
| **Buku Jurnal** | `/journals` | Buku besar jurnal umum transaksi otomatis double-entry dengan indikator keseimbangan debit/kredit. |
| **Pusat Laporan** | `/reports/*` | 6 laporan operasional (Rekap ACC, Realisasi, Per Proyek, Per PIC, Kas & Bank, Jurnal) dengan filter dan export. |
| **Master Data** | `/master/*` | Manajemen master Proyek, Sub-Unit, Kategori Biaya, PIC Lapangan, Rekening Kas/Bank, dan COA Akuntansi. |

---

## 4. Gambaran Database (PostgreSQL & Prisma ORM)

Arsitektur database dirancang dengan integritas data tingkat tinggi:

- `users`: Pengguna dan staf administrasi.
- `cash_sequences`: Generator sequence atomik anti-tabrakan untuk `KU` (Kas Umum) dan `KT` (Kas Terikat).
- `projects` & `project_sub_units`: Master hierarki proyek dan sub-proyek.
- `expense_categories` & `expense_sub_categories`: Master pos kategori beban operasional.
- `field_pics`: Master personel penanggung jawab lapangan.
- `cash_accounts`: Master rekening kas fisik dan bank operasional.
- `submission_batches` & `acc_expense_items`: Batch pengajuan dan item transaksi ACC berstatus `APPROVED`, `PARTIALLY_REALIZED`, `FULLY_REALIZED`, atau `CANCELLED`.
- `fund_inflows`: Transaksi dropping dana penerimaan kas/bank berstatus `POSTED` atau `VOID`.
- `disbursements` & `disbursement_items`: Voucher pencairan dana keluar dan rincian alokasi ke item ACC.
- `coa_accounts` & `category_coa_mappings`: Bagan akun standar dan pemetaan otomatis pos biaya ke COA debit.
- `journal_entries` & `journal_lines`: Ayat jurnal umum double-entry dengan constraint idempoten.

---

## 5. Aturan Finansial (*Financial Rules*)

1. **No Kas Unik**: Format otomatis `KT.YY.XXXX` atau `KU.YY.XXXX` terproteksi unique constraint tingkat database.
2. **Approved Amount**: Nominal pagu disetujui atasan wajib $> 0$.
3. **Pencegahan Overpayment**: Total realisasi pencairan tidak boleh melebihi nominal ACC disetujui:
   $$\sum \text{Realized Amount} \le \text{Approved Amount}$$
4. **Pencegahan Saldo Negatif**: Pencairan wajib ditolak server jika saldo kas pembayar tidak mencukupi:
   $$\text{Saldo Kas Saat Ini} \ge \text{Total Pencairan}$$
5. **Keseimbangan Jurnal Double-Entry**: Setiap voucher mutasi kas wajib membentuk ayat jurnal balance:
   $$\sum \text{Debit} === \sum \text{Credit}$$
6. **Mekanisme VOID**: Transaksi `POSTED` tidak boleh dihapus secara permanen (*Zero Hard Delete*). VOID membalikkan saldo kas, mengembalikan status & outstanding ACC, dan menandai jurnal audit sebagai `VOID`.

---

## 6. Persyaratan Sistem & Environment Variables

### Persyaratan
- **Node.js**: v18.18+ atau v20+
- **Database**: PostgreSQL (direkomendasikan Neon Serverless atau PostgreSQL lokal)

### Environment Variables (`.env`)
```env
DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[dbname]?sslmode=require"
DIRECT_URL="postgresql://[user]:[password]@[host]:[port]/[dbname]?sslmode=require"
```

---

## 7. Panduan Menjalankan Sistem

### Instalasi Dependensi
```bash
npm install
```

### Sinkronisasi & Migrasi Database
```bash
# Push skema ke database
npm run db:push

# Generate Prisma Client
npm run db:generate
```

### Seeding Data Awal
Untuk mengisi master proyek, kategori, PIC, kas/bank, dan COA awal:
```bash
npm run db:seed
```

### Menjalankan Automated Tests
Sistem dilengkapi 3 suite pengujian otomatis (85 assertion finansial & konsistensi):
```bash
npm test
```

### Menjalankan di Mode Development
```bash
npm run dev
```
Akses aplikasi melalui browser: `http://localhost:3000`

### Menjalankan di Mode Production
```bash
# Build bundle produksi
npm run build

# Start server produksi
npm run start
```

### Linter & Typecheck
```bash
# Linter ESLint
npm run lint

# TypeScript verification
npx tsc --noEmit
```

---

## 8. Format Export Data

### Microsoft Excel (`.xlsx`) — Primary Export
- Dihasilkan server-side menggunakan pustaka **ExcelJS**.
- Memiliki header resmi, freeze panes, auto-filter, formatting angka mata uang rupiah asli (`#,##0`), tanggal rapi, dan baris total bergaris ganda.
- Penamaan file otomatis kontekstual, misalnya `ProTrack_Rekap_ACC_2026-10-01.xlsx`.

### Dokumen PDF (`.pdf`) — Secondary Export
- Dihasilkan server-side menggunakan pustaka **jsPDF** & **jspdf-autotable**.
- Orientasi A4 Landscape untuk tabel berkolom banyak (Rekap ACC, Realisasi, Jurnal) dan Portrait untuk ringkasan (Proyek, Kas & Bank).
- Header resmi ProTrack, running footer dinamis (*Halaman X dari Y*), dan grid tabel dengan kontras administratif yang bersih.
