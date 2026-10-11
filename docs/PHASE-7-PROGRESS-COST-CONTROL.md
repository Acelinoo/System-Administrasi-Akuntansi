# PROTRACK — LAPORAN PHASE 7: MONITORING PROGRES & PENGENDALIAN BIAYA PROYEK

## 1. Fitur yang Sudah Tersedia Sebelum Perubahan
Sebelum pelaksanaan Phase 7, ProTrack telah memiliki fondasi data proyek dan akuntansi dari Phase 1–6:
1. **Model Relasional Proyek Terpadu**:
   - Master data `Project` (kode, nama, nilai kontrak, tanggal target mulai dan selesai, tipe proyek, konfirmasi status).
   - Dokumen `ProjectBudget` dan `BudgetItem` (RAP / RAB proyek multi-versi).
   - `ProjectTermin` (termin rencana penagihan dan status pelunasan).
   - `ProjectProgressLog` (catatan opname fisik lapangan dari bagian sipil).
   - `VendorContract` (kontrak pihak ketiga, supplier, dan subkontraktor).
   - `ExpenseItemDetail` (rincian material opsional di bawah item pengeluaran).
2. **Project 360° Dashboard (`/projects/[id]`)**:
   - Menampilkan ringkasan metrik 8 kartu hero finansial proyek (Nilai Kontrak, Pagu RAP, Penerimaan Inflow, Pengeluaran Realisasi, Sisa Kontrak, Saldo Penerimaan Bersih, Sisa RAP, Komparasi Progres).
   - Navigasi tab untuk Pos Biaya, RAP, Termin, Pengeluaran, Vendor, Progres Fisik, dan Jurnal Akuntansi.
3. **Laporan Monitoring Proyek (`/reports/projects`)**:
   - Rekapitulasi tabular per proyek dengan filter tanggal dan dropdown proyek.
   - Pengeksporan ke format Excel dan PDF.
4. **Isolasi Transaksi & Akuntansi**:
   - Transaksi pencairan berstatus `POSTED` mengurangi saldo kas/bank dan dicatat pada jurnal double-entry seimbang.
   - Transaksi `VOID` dibatalkan tanpa hard-delete untuk menjaga jejak audit.

---

## 2. Kekurangan yang Ditemukan
Dari audit menyeluruh terhadap alur operasional dan kode sumber:
1. **Ketiadaan Indikator Peringatan Dini Proaktif di Halaman Detail Proyek**:
   - Status varians biaya (`costVarianceStatus`) sebelumnya hanya muncul di footer tabel pos biaya, bukan di banner peringatan atas halaman. Pengguna tidak langsung diperingatkan jika proyek telah *Over Budget*, mendekati batas pagu RAP (&ge;90%), belum memiliki dokumen RAP, atau belum memiliki catatan progres fisik.
2. **Ketiadaan Kolom Status Kontrol pada Tabel Monitoring Proyek (`/reports/projects`)**:
   - Tabel monitoring pada `/reports/projects` belum menampilkan kolom status pengendalian biaya (misal badge `OVER BUDGET`, `MENDEKATI RAP`, `AMAN`, `TANPA RAP`), sehingga staf harus membuka detail proyek satu per satu untuk mengetahui status deviasi biaya.
3. **Ketiadaan Deteksi Keterlambatan Fisik Terhadap Jadwal Waktu Kontrak**:
   - Sistem belum menghitung estimasi durasi waktu kontrak yang telah berjalan (*schedule elapsed %*) berdasarkan `targetStartDate` dan `targetEndDate` proyek, sehingga tidak dapat mendeteksi deviasi jika progres fisik tertinggal jauh dari durasi waktu yang sudah berjalan.
4. **Dukungan `dataScope` pada Halaman Detail Proyek (`/projects/[id]`)**:
   - Halaman detail proyek (`src/app/projects/[id]/page.tsx`) belum membaca `searchParams` (`?scope=TEST`), sehingga saat pengujian terisolasi dilakukan dengan scope `TEST`, halaman tetap memuat data scope `REAL`.
5. **Ketiadaan Kolom Status Kontrol pada Berkas Ekspor Excel & PDF**:
   - Hasil unduhan Excel dan PDF untuk Laporan Proyek belum memuat kolom status kontrol biaya dan persentase *burn rate*.

---

## 3. Perubahan yang Benar-Benar Dilakukan
1. **Penyempurnaan Layanan Finansial Proyek ([src/lib/finance/project-360.service.ts](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/src/lib/finance/project-360.service.ts))**:
   - Menambahkan metrik baru pada `ProjectCostControlMetrics`:
     - `budgetBurnRatePct`: Persentase realisasi biaya terhadap total pagu RAP (`(Realisasi / RAP) * 100`).
     - `scheduleElapsedPct`: Persentase linier durasi kontrak yang telah berjalan berdasarkan `targetStartDate` dan `targetEndDate`.
     - `scheduleLagPct`: Selisih antara `scheduleElapsedPct` dan `physicalProgressPct`.
     - `isScheduleLagging`: Penanda otomatis jika progres fisik tertinggal > 10% dari estimasi linier waktu.
     - `hasBudget`: Boolean penanda ketersediaan dokumen RAP aktif.
     - `hasProgressLog`: Boolean penanda ketersediaan catatan opname fisik.
2. **Banner Peringatan Proaktif pada Antarmuka Project 360° ([src/app/projects/[id]/Project360Client.tsx](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/src/app/projects/%5Bid%5D/Project360Client.tsx))**:
   - Menambahkan banner peringatan visual dengan warna dan hierarki tegas:
     - 🚨 **OVERBUDGET** (Merah): Realisasi melebihi RAP, menampilkan selisih overbudget dan burn rate.
     - ⚠️ **MENDEKATI ANGGARAN** (Kuning): Realisasi mencapai &ge;90% RAP beserta sisa anggaran yang tersisa.
     - ℹ️ **BELUM ADA RAP** (Slate): Proyek memiliki pengeluaran tetapi belum memiliki pagu RAP.
     - 📋 **BELUM ADA OPNAME FISIK** (Muted): Pengingat bagi pengawas sipil untuk menginput opname berkala.
     - ⏱️ **KETERLAMBATAN FISIK** (Oranye): Peringatan jika progres fisik tertinggal > 10% dibanding durasi linier waktu proyek.
3. **Dukungan Scope Testing pada Halaman Detail Proyek ([src/app/projects/[id]/page.tsx](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/src/app/projects/%5Bid%5D/page.tsx))**:
   - Membaca `searchParams.scope` / `searchParams.dataScope` dan meneruskannya ke `getProject360Data(id, scope)` agar pengujian UAT browser scope TEST berjalan aman dan terisolasi.
4. **Kolom Status Kontrol pada Layanan Laporan Proyek ([src/lib/reports/project-report.service.ts](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/src/lib/reports/project-report.service.ts))**:
   - Menambahkan `costVarianceStatus`, `budgetBurnRatePct`, `scheduleElapsedPct`, `hasBudget`, dan `hasProgressLog` pada `ProjectReportSummary`.
   - Mengagregasi metrik `overBudgetCount`, `warningBudgetCount`, `healthyBudgetCount`, dan `noBudgetCount` pada `totals`.
5. **Pembaruan Halaman Laporan Monitoring Proyek ([src/app/reports/projects/page.tsx](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/src/app/reports/projects/page.tsx))**:
   - Menambahkan kolom **Status Kontrol** pada tabel monitoring dengan badge:
     - `OVER BUDGET`
     - `MENDEKATI RAP (XX%)`
     - `AMAN (XX%)`
     - `Tanpa RAP`
   - Menambahkan alert banner di atas tabel jika ditemukan proyek yang *Over Budget* atau mendekati pagu RAP.
   - Menambahkan badge `TEST MODE` jika parameter `?scope=TEST` aktif.
6. **Pembaruan Format Ekspor ([src/lib/export/excel-export.service.ts](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/src/lib/export/excel-export.service.ts) & [src/lib/export/pdf-export.service.ts](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/src/lib/export/pdf-export.service.ts))**:
   - Menambahkan kolom `Status Kontrol` pada berkas unduhan Excel dan PDF.

---

## 4. Definisi dan Rumus Metrik

| Metrik | Definisi Bisnis | Rumus / Logika Perhitungan |
|---|---|---|
| **Nilai Kontrak Induk** | Plafon nilai kesepakatan penagihan dengan pemilik proyek | `Project.contractValue` |
| **Pagu RAP / RAB** | Total anggaran biaya pelaksanaan dari versi RAP aktif terbaru | `Sum(BudgetItem.totalAmount)` pada `ProjectBudget` versi teratas (`orderBy: createdAt desc`) |
| **Penerimaan Aktual (Inflow)** | Kas riil yang sudah diterima dari pemilik proyek | `Sum(FundInflow.amount)` di mana `status = POSTED` dan `projectId = id` |
| **Biaya Aktual (Realisasi Keluar)** | Pengeluaran kas riil yang telah dibayarkan melalui voucher pencairan | `Sum(DisbursementItem.realizedAmount)` di mana `Disbursement.status = POSTED` |
| **Sisa Anggaran RAP** | Sisa plafon biaya pelaksanaan proyek yang masih dapat digunakan | `Pagu RAP - Biaya Aktual` (bernilai negatif jika over-budget) |
| **Budget Burn Rate (%)** | Tingkat serapan anggaran pengeluaran terhadap pagu RAP | `(Biaya Aktual / Pagu RAP) * 100%` (hanya jika Pagu RAP > 0) |
| **Status Varians Biaya** | Klasifikasi kondisi kesehatan anggaran proyek | - `OVERBUDGET`: Jika `Biaya Aktual > Pagu RAP`<br>- `WARNING`: Jika `Biaya Aktual >= 0.9 * Pagu RAP`<br>- `HEALTHY`: Jika `Biaya Aktual < 0.9 * Pagu RAP`<br>- `NO_BUDGET`: Jika belum ada pagu RAP (`Pagu RAP = 0`) |
| **Saldo Penerimaan Bersih** | Posisi kas bersih proyek (kemampuan menutup pengeluaran) | `Penerimaan Aktual - Biaya Aktual` |
| **Progres Penerimaan (%)** | Rasio kas termin yang telah diterima terhadap total kontrak | `(Penerimaan Aktual / Nilai Kontrak) * 100%` |
| **Progres Fisik Sipil (%)** | Capaian persentase pekerjaan lapangan terkini dari pengawas sipil | `ProjectProgressLog.physicalProgressPct` dari log terbaru (`orderBy: logDate desc`) |
| **Durasi Jadwal Berjalan (%)** | Estimasi linier durasi kontrak yang telah dilalui waktu | `((Now - TargetStartDate) / (TargetEndDate - TargetStartDate)) * 100%` (0 s.d. 100%) |
| **Keterlambatan Fisik (Lag %)** | Deviasi keterlambatan fisik terhadap estimasi linier waktu | `Durasi Jadwal Berjalan % - Progres Fisik %` (Peringatan aktif jika deviasi > 10%) |

### Pencegahan Double-Counting & Integritas:
- **Pengeluaran Riil**: Hanya dihitung dari `DisbursementItem` berstatus `POSTED`.
- **Rincian Material (`ExpenseItemDetail`)**: Merupakan rincian nota/barang di bawah item pengeluaran, **tidak dijumlahkan** ke dalam total pengeluaran kas agar tidak terhitung dua kali.
- **Jurnal Akuntansi (`JournalLine`)**: Merupakan proyeksi buku besar akuntansi, **tidak dijumlahkan** ke dalam total pengeluaran kas.
- **Penerimaan Dana Masuk (`FundInflow`)**: Merupakan sisi debit kas masuk/ekuitas, bukan biaya proyek.
- **Transaksi VOID**: 100% dikecualikan dari perhitungan realisasi biaya dan penerimaan kas.

---

## 5. Hasil Pengujian Aktual
Pengujian otomatis terisolasi dieksekusi melalui [tests/phase7-progress-cost-control.ts](file:///c:/Marchelino%20Kurniawan/Project-2026/Admsystem/tests/phase7-progress-cost-control.ts) menggunakan `dataScope: TEST`:

| No | Kasus Uji | Hasil | Keterangan Aktual |
|---|---|:---:|---|
| 0 | Baseline REAL Invariant Pre-Check | **PASS** | 379 batches, 1028 items, Rp4.303.052.418, 0 REAL disb, 0 REAL journals |
| 1 | Penyusunan RAP & Status Anggaran Awal | **PASS** | RAP Rp20jt, Realisasi Rp0, Sisa Rp20jt, Status `HEALTHY` |
| 2 | Realisasi 50% Anggaran (Rp10jt / Rp20jt) | **PASS** | Realisasi Rp10jt, Burn Rate 50%, Sisa Rp10jt, Status `HEALTHY` |
| 3 | Realisasi 92.5% Anggaran (Rp18.5jt / Rp20jt) | **PASS** | Realisasi Rp18.5jt, Burn Rate 92.5%, Sisa Rp1.5jt, Status `WARNING` |
| 4 | Realisasi Melampaui RAP (Rp21.5jt / Rp20jt) | **PASS** | Realisasi Rp21.5jt, Burn Rate 107.5%, Sisa -Rp1.5jt, Status `OVERBUDGET` |
| 5 | Pencegahan Double Counting | **PASS** | Penambahan ExpenseItemDetail Rp5jt tidak menggandakan realisasi (tetap Rp21.5jt) |
| 6 | Pengecualian Transaksi VOID | **PASS** | Pembatalan voucher Rp3jt langsung menurunkan realisasi kembali ke Rp18.5jt dan status kembali `WARNING` |
| 7 | Monitoring Progres Fisik & Histori Opname | **PASS** | Log 1 (15%) dan Log 2 (35%) tersimpan urut tanggal, capaian terkini terbaca 35% |
| 8 | Integrasi Laporan Monitoring Proyek | **PASS** | `getProjectReport` menyajikan pagu, realisasi, burn rate, status varians, dan progres fisik secara presisi |
| 9 | Verifikasi Baseline REAL Pasca-Uji | **PASS** | Seluruh data operasional REAL 100% utuh tanpa perubahan |

Pemeriksaan Kode:
- `npx tsc --noEmit`: **Exit code 0 (0 error)**
- `npm run lint`: **Exit code 0 (0 error, 0 warning)**

---

## 6. Verifikasi Integritas Data REAL
Pengujian membuktikan bahwa data operasional riil terlindungi secara mutlak:
- **Submission Batches REAL**: 379 batch (tetap).
- **ACC Expense Items REAL**: 1.028 item (tetap).
- **Total Approved Amount REAL**: Rp 4.303.052.418 (tetap).
- **Voucher Pencairan REAL**: 0 voucher (tetap).
- **Jurnal Akuntansi REAL**: 0 ayat jurnal (tetap).

---

## 7. Status Phase 7
**SELESAI (COMPLETE) — Tanpa Blocker.**  
Sistem monitoring progres fisik dan pengendalian biaya proyek berfungsi secara presisi, bebas dari duplikasi perhitungan (*zero double counting*), tanggap terhadap status pembatalan (*VOID exclusion*), serta menyediakan peringatan dini (*early warning indicators*) yang informatif bagi manajemen proyek.

---

## 8. Rekomendasi Singkat untuk Phase 8
1. Melanjutkan ke **Phase 8 — Rekonsiliasi, Audit Keuangan Akhir, & Export / Reporting Readiness** ketika user memberikan instruksi.
2. Mempertahankan disiplin isolasi data `dataScope: TEST` dan proteksi 100% terhadap baseline transaksi operasional `REAL`.
