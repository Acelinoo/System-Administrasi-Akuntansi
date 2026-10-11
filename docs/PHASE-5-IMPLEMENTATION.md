# PROTRACK — DOKUMENTASI IMPLEMENTASI FASE 5
## Pengeluaran, Material, Upah, Vendor/Subkontrak, dan Pengendalian Biaya

**Workspace:** `C:\Marchelino Kurniawan\Project-2026\Admsystem`  
**Branch:** `main`  
**Tanggal:** 10 Oktober 2026  
**Status:** **SELESAI & TERVERIFIKASI (PRODUCTION-READY)**  

---

## 1. Ringkasan Eksekutif & Tujuan

Fase 5 memperkuat dan merapikan seluruh aspek pencatatan pengeluaran operasional dan pembiayaan proyek di ProTrack secara terpadu tanpa memecah pekerjaan ke subfase parsial:
1. **Pengeluaran Material**: Memastikan rincian material mencatat nama barang spesifik, kuantitas, satuan, harga satuan, kalkulasi total otomatis di sisi server, asosiasi rekanan vendor/supplier, nomor referensi nota/bukti, dan catatan spesifikasi.
2. **Pengeluaran Upah & Operasional**: Menjamin pencatatan beban tenaga kerja harian, lemburan, logistik lapangan, dan operasional umum terhubung langsung ke proyek, akun kas/bank, PIC mandor, No Kas KU/KT, dan batch ACC manajemen.
3. **Tracking Kontrak Vendor & Subkontraktor**: Menyediakan visibilitas penuh terhadap komitmen kontrak SPK, realisasi pembayaran yang telah dicairkan (`paidAmount`), sisa kewajiban saldo kontrak (`remainingBalance`), dan persentase progres pemenuhan komitmen tanpa mengarang data historis yang tidak ada.
4. **Pencegahan Biaya Ganda (Zero Double-Counting)**: Mengunci konsistensi kalkulasi beban proyek agar tidak terjadi duplikasi antara realisasi pencairan (`disbursementItems`), rincian breakdown material (`expenseItemDetails`), dan baris jurnal buku besar (`journalLines`).
5. **Disiplin Transaksi (POSTED vs VOID)**: Memastikan hanya transaksi `POSTED` yang diakui dalam saldo kas, rekap biaya proyek, dan pelunasan vendor. Transaksi `VOID` memulihkan saldo kas, merestorasi status item ACC, dan mengembalikan sisa saldo kewajiban kontrak.
6. **Analisis Gap Akuntansi Kasbon, Talangan & Kontrabon**: Mengidentifikasi pemetaan Chart of Accounts (COA) aktual dan mendokumentasikan batas perlakuan akuntansi serta SOP operasional secara transparan.
7. **Validasi & Proteksi Relasional Ketat**: Mencegah kuantitas/harga satuan negatif, nilai kontrak nol/negatif, tanggal tidak logis, relasi ID yang tidak valid, serta penghapusan vendor yang masih terikat kontrak/transaksi.
8. **Konsistensi Desain Modal ProTrack**: Memperbaiki modal Vendor/Subkontrak dan Rincian Material agar konsisten dengan standar UI ProTrack (label wajib bertanda bintang, petunjuk hint, kalkulasi subtotal instan, dan penutupan modal via tombol/backdrop/ESC).
9. **Isolasi Pengujian Mutlak (`dataScope: TEST`)**: Memverifikasi seluruh skenario pengujian secara otomatis tanpa memutasikan data operasional `REAL` (invarian baseline 100% terjaga sebelum dan sesudah pengujian).

---

## 2. Arsitektur Terpadu & Alur Bisnis Pengeluaran

```
                     [Pengajuan Kebutuhan ACC (KU / KT)]
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
      [Kategori UPAH]        [Kategori MATERIAL]       [Kategori SUBKON]
      • Upah Tukang          • Semen, Besi, Pasir      • SPK Subkontraktor
      • Upah Mandor          • Nota Toko Rekanan       • Kontrak Borongan
      • PIC Lapangan         • Rincian Qty x Harga     • Tracking Termin SPK
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
                        [Persetujuan ACC Manajemen]
                        • No Kas Unik (KU/KT.YY.xxx)
                        • Pagu Sah Disetujui (Approved)
                        • Sisa Outstanding = Approved
                                     │
                                     ▼
                   [Pencairan Kas/Bank (Disbursement)]
                   • Cek Saldo Kas Cukup (Anti Saldo Negatif)
                   • Cek Anti Overpayment (Realized <= Outstanding)
                   • Realisasi Parsial vs Pelunasan
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
            [Buku Kas & Jurnal]            [Project 360° & Tracking]
         • Saldo Kas Berkurang          • Total Beban Realisasi (POSTED)
         • Debet COA 5101/5102/5103     • Zero Double-Counting
         • Debet COA 1150 (Kasbon)      • Realisasi SPK Vendor Terbayar
         • Debet 2101 (Kontrabon)       • Sisa Saldo Kontrak Vendor
         • Kredit Kas/Bank 1101/1102    • Progres Pembayaran SPK (%)
```

---

## 3. Analisis Gap Akuntansi: Kasbon, Talangan, Kontrabon, dan Vendor

Berdasarkan inspeksi langsung master data Chart of Accounts (COA) dan `category_coa_mappings`:

### 3.1. Kasbon & Uang Muka Mandor (`KASBON`)
- **Pemetaan COA Aktual**: Debet Akun `1150 - Uang Muka & Kasbon Mandor/Tukang` (Aktiva Lancar / Piutang), Kredit Akun Kas/Bank `1101/1102`.
- **Perlakuan Akuntansi**: Pencairan kasbon mandor tidak diakui sebagai beban langsung proyek pada saat dicairkan, melainkan sebagai piutang uang muka perusahaan kepada mandor.
- **Gap SOP Teridentifikasi**:
  - ProTrack saat ini belum memiliki modul **Settlement / Rekonsiliasi Kasbon (SPJ & Potong Upah Mingguan)**.
  - Saat mandor menerima upah mingguan berikutnya, pemotongan kasbon belum terjadi otomatis melalui sistem (jurnal penyesuaian: Debet `5101 - Beban Upah`, Kredit `1150 - Kasbon Mandor`).
  - *Keputusan Operasional*: Pertahankan pemetaan ke `1150`. Dokumentasikan bahwa penyelesaian kasbon memerlukan konfirmasi bukti potongan manual pada uraian voucher upah sampai modul SPJ mandor dibangun.

### 3.2. Talangan Staf Lapangan (`TALANGAN`)
- **Pemetaan COA Aktual**: Menggunakan fallback Debet Akun `5105 - Beban Operasional Lapangan & Logistik` (Beban Pokok Proyek), Kredit Kas/Bank `1101/1102`.
- **Perlakuan Akuntansi**: Penggantian dana staf atas pengeluaran darurat lapangan diakui sebagai beban operasional proyek.
- **Gap SOP Teridentifikasi**:
  - Jika staf menalangi pembelian material semen atau besi, pencairan dengan kategori `TALANGAN` akan terbukukan ke `5105` (Beban Operasional), bukan `5102` (Beban Material), kecuali staf memilih kategori `MATERIAL` dengan keterangan "Talangan [Nama Staf]".
  - *Keputusan Operasional*: Staf diarahkan mengisi kategori sesuai hakikat barang (misal: MATERIAL) dan menuliskan keterangan penggantian talangan pada uraian voucher.

### 3.3. Kontrabon & Hutang Toko (`KONTRABON`)
- **Pemetaan COA Aktual**: Debet Akun `2101 - Hutang Usaha & Kontrabon Vendor` (Kewajiban Lancar), Kredit Kas/Bank `1101/1102`.
- **Perlakuan Akuntansi**: Pengeluaran kas kontrabon mengurangi saldo kewajiban kepada supplier toko.
- **Gap SOP Teridentifikasi**:
  - Karena sistem berjalan pada *cash-basis* pencairan kas proyek, pembayaran kontrabon langsung mendebet akun `2101`. Jika belum ada modul pencatatan faktur pembelian tempo (*AP Invoice Entry*) yang mengkredit `2101`, akun `2101` akan memiliki saldo debet.
  - *Keputusan Operasional*: Pertahankan alur tanpa membuat jurnal tagihan fiktif sampai modul Account Payable (AP) resmi dirancang.

### 3.4. Kontrak Subkontraktor Lapangan (`SUBKON`)
- **Pemetaan COA Aktual**: Debet Akun `5103 - Beban Pokok Proyek - Subkontraktor`, Kredit Kas/Bank `1101/1102`.
- **Penelusuran Komitmen & Saldo**: Setiap SPK subkon kini memiliki tracking:
  - `contractValue` (Nilai Kontrak Komitmen)
  - `paidAmount` (Total Realisasi POSTED untuk rekanan vendor pada proyek terkait)
  - `remainingBalance` = `Math.max(0, contractValue - paidAmount)`
  - `paymentProgressPct` = `(paidAmount / contractValue) * 100%`

---

## 4. Pencegahan Pencatatan Biaya Ganda (Zero Double-Counting)

Untuk memastikan laporan biaya proyek dan Project 360° mencerminkan realitas kas yang akurat:
1. **Disbursement Items vs Project Journals**:
   - Total pengeluaran proyek (`totalPostedExpense`) dihitung **hanya dari satu sumber kebenaran**: `accItems.disbursementItems` yang berstatus `POSTED`.
   - `journalLines` disajikan pada tab "Jurnal Proyek" sebagai jejak audit akuntansi (*general ledger audit trail*) dan **TIDAK ditambahkan kembali** ke dalam total pengeluaran proyek.
2. **Disbursement Items vs Expense Item Details**:
   - `ExpenseItemDetail` merupakan rincian opsional barang (kuantitas × harga satuan) dari item ACC.
   - Total rincian material **TIDAK dijumlahkan terpisah** ke dalam pengeluaran proyek karena pagu biaya telah diwakili oleh pencairan item ACC induknya.
3. **Transaksi VOID**:
   - Transaksi berstatus `VOID` secara tegas dikecualikan dari perhitungan saldo kas, pengeluaran proyek, dan saldo terbayar kontrak vendor.

---

## 5. Ringkasan File yang Dimodifikasi & Ditambahkan

| File | Tindakan | Deskripsi Perubahan |
|---|---|---|
| `src/lib/validation/vendor-expense.schema.ts` | **Created** | Skema Zod untuk validasi rincian material (`createExpenseItemDetailSchema`), kontrak vendor (`createVendorContractSchema`), dan master vendor (`createVendorSchema`, `updateVendorSchema`). |
| `src/lib/finance/project-360.service.ts` | **Modified** | Menambahkan kalkulasi finansial kontrak vendor (`paidAmount`, `remainingBalance`, `paymentProgressPct`), validasi kuantitas/harga material di tingkat service, serta fungsi mutasi `deleteExpenseItemDetail` dan `deleteVendorContract`. |
| `src/app/actions/project-360.actions.ts` | **Modified** | Menerapkan validasi Zod ketat pada `createExpenseItemDetailAction` dan `createVendorContractAction`. Menambahkan action `deleteExpenseItemDetailAction` dan `deleteVendorContractAction`. |
| `src/app/actions/master.actions.ts` | **Modified** | Menambahkan validasi nama vendor minimal 2 karakter dan proteksi relasional pada `deleteVendorAction` (mencegah penghapusan vendor yang memiliki kontrak atau rincian transaksi). |
| `src/app/projects/[id]/Project360Client.tsx` | **Modified** | Memperbarui Tab Vendor dengan KPI ringkasan, kolom Realisasi Terbayar, Sisa Saldo, dan Progres %. Menambahkan tombol hapus rincian material. Memoles modal Material dan Kontrak Vendor (live total, hint, label wajib bintang, backdrop close). |
| `src/app/acc/[id]/AccMaterialDetailsSection.tsx` | **Created** | Komponen client interaktif pada halaman detail ACC untuk melihat daftar rincian barang, menghapus rincian, dan membuka modal penambahan rincian material dengan kalkulasi total instan. |
| `src/app/acc/[id]/page.tsx` | **Modified** | Mengintegrasikan `AccMaterialDetailsSection` dan lookup master vendor ke halaman detail ACC. |
| `src/app/master/vendors/VendorsManager.tsx` | **Modified** | Menambahkan tombol dan aksi hapus vendor dengan guard relasi, serta perilaku tutup modal saat klik backdrop. |
| `tests/phase5-expenses-vendors.ts` | **Created** | Rangkaian tes integrasi terisolasi mencakup 10 skenario wajib Fase 5 dengan pembuktian invarian baseline REAL sebelum dan sesudah. |
| `docs/PHASE-5-IMPLEMENTATION.md` | **Created** | Dokumen laporan implementasi komprehensif Fase 5. |

---

## 6. Hasil Pengujian Otomatis Aktual

Pengujian dieksekusi melalui command:
```bash
npx tsx tests/phase5-expenses-vendors.ts
```

### Log Eksekusi Aktual:
```text
================================================================================
  PROTRACK FASE 5 — INTEGRATED TEST SUITE
  Scope: Material, Upah, Ops, Kasbon, Talangan, Kontrabon & Vendor/Subkontrak
================================================================================

[STEP 0] Baseline REAL Verification:
{
  "batches": 379,
  "items": 1028,
  "approvedSum": "4303052418",
  "unassignedMandor": 723,
  "postedDisbursements": 0,
  "postedInflows": 0,
  "journalEntries": 0
}
✓ Initial REAL baseline confirmed 100% intact.
✓ Seeded test bank balance: Rp150.000.000
✓ Created isolated test vendors: TB. Sentosa Material Abadi Test & CV. Baja Perkasa Subkon Test

[TEST 1] Testing Material Itemization & Automatic Total Calculation...
  ✓ 3 rincian material berhasil dicatat: Total = Rp22.000.000 (Pagu ACC = Rp25.000.000)
  ✓ Pengujian hapus dan tambah ulang rincian material berhasil terverifikasi.

[TEST 2] Testing Input Validations & Relational Guards...
  ✓ Kuantitas negatif ditolak secara ketat.
  ✓ Kuantitas 0 ditolak secara ketat.
  ✓ Harga satuan negatif ditolak secara ketat.
  ✓ Relasi vendor yang tidak terdaftar ditolak secara ketat.

[TEST 3] Testing Upah, Operasional, Kasbon, Talangan, and Kontrabon Items...
  ✓ 5 item pengeluaran ACC berhasil dibuat (Upah, Ops, Kasbon, Talangan, Kontrabon)

[TEST 4] Testing Vendor / Subkontrak Contract Tracking...
  ✓ Kontrak vendor sebelum pencairan: Nilai = Rp50.000.000, Terbayar = Rp0, Sisa = Rp50.000.000 (100% akurat)

[TEST 5] Testing Multi-Tranche Disbursement (Partial & Settlement) on Subcontract...
  ✓ Tranche 1 (Parsial) berhasil: Terbayar = Rp10.000.000, Sisa Saldo = Rp40.000.000 (Progres 20%)
  ✓ Tranche 2 (Pelunasan) berhasil: Terbayar = Rp20.000.000, Sisa Saldo = Rp30.000.000 (Progres 40%)

[TEST 6] Testing Disbursements & Journal Mappings (Upah, Ops, Kasbon, Talangan, Kontrabon)...
  ✓ Jurnal Double-Entry terverifikasi seimbang dan akurat:
    • Debet 5101 (Beban Upah): Rp15.000.000
    • Debet 5105 (Beban Operasional Lapangan): Rp3.000.000
    • Debet 1150 (Uang Muka & Kasbon Mandor): Rp5.000.000
    • Debet 5105 (Talangan Staf / Lapangan): Rp2.000.000
    • Debet 2101 (Hutang Usaha & Kontrabon): Rp10.000.000
    • Kredit 1102 (Rekening Bank Operasional): Rp35.000.000

[TEST 7] Verifying Zero Double-Counting across Project 360 & Cost Recaps...
  ✓ Rekap pengeluaran proyek = Rp55.000.000 (Zero double-counting: rincian material & baris jurnal TIDAK dihitung ganda).

[TEST 8] Testing POSTED vs VOID Reversal Behavior...
  ✓ Saldo kas berhasil dipulihkan (+Rp10.000.000): Rp105.000.000
  ✓ Status item ACC mundur ke PARTIALLY_REALIZED dan saldo vendor contract mundur ke Rp10.000.000 (Akurat).

[TEST 9] Testing Deletion Guard on Vendors with Active Contracts...
  ✓ Guard proteksi vendor berhasil memblokir hapus: "Vendor tidak dapat dihapus karena telah terkait dengan 1 kontrak dan 1 rincian transaksi pengeluaran. Anda dapat menonaktifkan status vendor ini."

[TEST 10] Testing Multi-Revision RAP & Category Pagu Comparison...
  ✓ Pagu RAP Berjalan memakai 1 versi acuan terbaru (Rp100.000.000), tidak menjumlahkan revisi historis.
  ✓ Kategori item RAP terpetakan presisi ke kategori biaya proyek:
    • UPAH: Pagu Rp40.000.000, Realisasi Rp15.000.000, Sisa Rp25.000.000
    • MATERIAL: Pagu Rp60.000.000, Realisasi Rp0, Sisa Rp60.000.000

[TEST 11] Testing PDF & Excel Export Generation & Character Encoding...
  ✓ PDF export berhasil digenerate (27559 bytes) dan bebas dari artefak karakter '!³'.
  ✓ Excel export berhasil digenerate (7861 bytes) dengan subtotal & pagu RAP konsisten.

[CLEANUP] Cleaning up all isolated TEST records...
✓ All isolated test data cleanly removed from database.

[FINAL VERIFICATION] Verifying REAL Baseline Invariants...
{
  "batches": 379,
  "items": 1028,
  "approvedSum": "4303052418",
  "unassignedMandor": 723,
  "postedDisbursements": 0,
  "postedInflows": 0,
  "journalEntries": 0
}

================================================================================
  ALL PHASE 5 INTEGRATION TESTS PASSED PERFECTLY!
  REAL BASELINE 100% UNTOUCHED AND VERIFIED IDENTICAL!
================================================================================
```

---

## 7. Verifikasi Baseline REAL & Regresi Sistem

### 7.1. Invarian Data REAL (Sebelum & Sesudah Pengujian)
| Metrik Invarian | Nilai Baseline REAL Awal | Nilai Baseline REAL Akhir | Status |
|---|---|---|---|
| Total Batch ACC | 379 batch | 379 batch | **100% IDENTIK** |
| Total Item ACC | 1.028 item | 1.028 item | **100% IDENTIK** |
| Total Nilai Disetujui (Approved) | Rp4.303.052.418 | Rp4.303.052.418 | **100% IDENTIK** |
| Mandor Belum Ditugaskan | 723 item | 723 item | **100% IDENTIK** |
| Pencairan POSTED REAL | 0 voucher | 0 voucher | **100% IDENTIK** |
| Penerimaan POSTED REAL | 0 transaksi | 0 transaksi | **100% IDENTIK** |
| Entri Jurnal REAL | 0 entri | 0 entri | **100% IDENTIK** |

### 7.2. Regression Test Fase 4 (`tests/phase4-acc-disbursement.ts`)
Rangkaian tes integrasi Fase 4 dieksekusi ulang secara penuh dan **lulus 100% (10 dari 10 skenario)** tanpa efek samping terhadap fitur terdahulu.

### 7.3. TypeScript Compilation, Lint, & Next.js Build
- `npx tsc --noEmit`: **0 error (Lulus Bersih)**.
- `npm run lint`: **0 warning / 0 error (Lulus Bersih)**.
- `next build`: **Kompilasi sukses (32 routes) tanpa error**.

---

## 8. Laporan Transparansi Status (Diuji, Diaudit, dan Gap Tersisa)

### A. Fitur yang Telah Diuji Secara Menyeluruh (Automated & Unit Verified):
1. **Pencatatan Rincian Material**: Kuantitas, satuan, harga satuan, kalkulasi total otomatis di sisi server, asosiasi vendor, nomor referensi dokumen, dan catatan spesifikasi.
2. **Validasi Input Ketat**: Penolakan kuantitas nol/negatif, harga satuan negatif, dan vendor tidak terdaftar.
3. **Manajemen Rincian Material**: Penambahan dan penghapusan rincian material dengan proteksi revalidasi halaman.
4. **Tracking Kontrak Vendor & Subkontrak**: Perhitungan nilai kontrak komitmen, realisasi terbayar, sisa komitmen kontrak, dan persentase penyelesaian.
5. **Pencairan Bertahap & Parsial**: Pembayaran bertahap untuk kontrak subkon dan update status item ACC.
6. **Pembukuan Double-Entry Jurnal**: Jurnal berpasangan seimbang untuk kategori Upah (5101), Operasional (5105), Kasbon (1150), Talangan (5105), dan Kontrabon (2101).
7. **Pencegahan Biaya Ganda (Zero Double-Counting)**: Rekap biaya proyek pada Project 360° menghitung realisasi disbursement satu kali tanpa menduplikasi baris jurnal atau rincian material.
8. **Mekanisme Reversal VOID**: Rollback saldo kas, pemulihan saldo komitmen vendor, dan pengembalian status item ACC ke PARTIALLY_REALIZED / APPROVED.
9. **Proteksi Relasional Vendor**: Pemblokiran penghapusan master vendor yang masih memiliki relasi kontrak atau rincian transaksi aktif.
10. **Multi-Revisi RAP & Pemetaan Kategori**: Pagu RAP berjalan hanya menggunakan 1 versi acuan aktif terbaru (tidak menjumlahkan revisi historis), dan kategori RAP dipetakan presisi ke kategori pengeluaran proyek (UPAH, MATERIAL, dll.).
11. **Perbaikan Ekspor PDF & Excel**:
    - Penghapusan artefak karakter `!³` (disebabkan oleh unicode `↳` U+21B3 pada font standar jsPDF Helvetica) dengan menggantinya menjadi karakter ASCII aman (`-`).
    - Konsistensi representasi nilai kosong (`-` vs `Rp0`).
    - Pagu RAP dan sisa anggaran tampil akurat dan seimbang dengan hasil query data.
12. **Isolasi Pengujian & Pembersihan TEST Record**: Seluruh record uji coba dibersihkan secara otomatis tanpa residu di database.
13. **Verifikasi Baseline REAL**: Baseline operasional REAL terbukti 100% tidak tersentuh sebelum dan sesudah pengujian.

### B. Fitur yang Telah Diaudit:
1. Hubungan relasi struktural transaksi terhadap Project, Cash Account, Category, PIC, dan Submission Batch.
2. Konsistensi tampilan modal Vendor & Subkon terhadap modal RAP (judul, subtitle, label wajib bertanda bintang, petunjuk input, kalkulasi subtotal instan, penanganan loading, dan penutupan via tombol/backdrop/ESC).
3. Struktur Chart of Accounts (COA) untuk kategori kasbon, talangan, dan kontrabon.

### C. Gap Tersisa untuk Keputusan Bisnis / SOP:
1. **Modul Rekonsiliasi Kasbon / Potong Upah (SPJ Mandor)**:
   - Kasbon mandor saat ini tersimpan di akun `1150` (Aktiva Lancar / Piutang Perusahaan). Mekanisme potong kasbon otomatis pada voucher upah mingguan berikutnya belum ada dan memerlukan kesepakatan SOP operasional keuangan mandor.
2. **Modul Pengakuan Hutang Pembelian Tempo (AP Invoice)**:
   - Transaksi kontrabon saat ini mendebet akun `2101` saat kas dicairkan (*cash-basis*). Integrasi faktur tagihan masuk bertempo dari supplier toko yang mengkredit `2101` sebelum pencairan belum tersedia. Sistem menampilkan sisa kontrak sebagai "Sisa Komitmen Kontrak", bukan "Hutang Usaha Terverifikasi".
3. **Data Historis UNASSIGNED_MANDOR**:
   - Sebanyak 723 item ACC berstatus `UNASSIGNED_MANDOR` dipertahankan sesuai aslinya tanpa melakukan auto-assignment spekulatif sampai ada konfirmasi tertulis dari tim administrasi lapangan.

### D. Hal yang Perlu Diuji Manual oleh Pengguna di Browser:
1. **Navigasi Detail ACC (`/acc/[id]`)**:
   - Buka item ACC kategori MATERIAL.
   - Periksa bagian **Rincian Barang & Material Lapangan**.
   - Masukkan rincian barang: Nama Barang, Kuantitas, Satuan, Harga Satuan, Rekanan Vendor, dan Nomor Referensi Nota.
   - Amati subtotal kalkulasi otomatis dan tombol Hapus rincian.
2. **Tab Vendor & Subkon pada Project 360° (`/projects/[id]`)**:
   - Buka Tab 5 (Vendor & Subkon).
   - Periksa 3 KPI card: Total Komitmen Kontrak, Realisasi Terbayar, dan Sisa Saldo Komitmen.
   - Buka modal **+ Tambah Kontrak Vendor/Subkon**: periksa modal backdrop click, tombol escape (ESC), indikator wajib `*`, dan petunjuk input.
3. **Pencairan Bertahap (`/disbursements/new`)**:
   - Buat pencairan sebagian untuk item ACC dengan nominal lebih kecil dari approved amount.
   - Periksa status item berubah menjadi `Sebagian Cair (PARTIALLY_REALIZED)`.
   - Lakukan pencairan kedua untuk sisa outstanding hingga berubah menjadi `Lunas (FULLY_REALIZED)`.
4. **Unduh Laporan PDF & Excel (`/reports/projects`)**:
   - Buka Laporan Rekapitulasi Alokasi Dana per Proyek.
   - Unduh PDF dan periksa baris rincian kategori: pastikan simbol curved arrow tidak lagi menghasilkan artefak karakter `!³`.
   - Unduh Excel dan periksa kolom Pagu RAP dan Sisa Anggaran tampil konsisten dengan nilai `-` untuk proyek tanpa RAP.

