# PROTRACK — LAPORAN AUDIT & RESET DATA UJI COBA IMPORT EXCEL

**Dokumen:** `docs/IMPORT-RESET-REPORT.md`  
**Proyek:** `c:\Marchelino Kurniawan\Project-2026\Admsystem`  
**Waktu Audit:** 11 Oktober 2026  
**Status Akhir:** **`BLOCKED — PRODUCTION DATABASE`** *(Tindakan Destruktif pada Database Produksi Dicegah 100%)*  
**Status Environment Pengujian:** **`TEST DATABASE RESET COMPLETE`** *(Cabang Terisolasi Siap Digunakan)*

---

## 1. RINGKASAN EKSEKUTIF & ATURAN KESELAMATAN

Sesuai **Aturan Keselamatan Wajib (Poin 1, 3, & 5)**:
1. Audit forensik terhadap koneksi database aktif di `.env` membuktikan bahwa database yang terhubung adalah **DATABASE REAL / PRODUKSI RESMI PROTRACK** (Neon Project `proud-violet-96345126`, endpoint `ep-super-feather-b3nya85u`, branch `main`).
2. Database tersebut memegang **Official Financial Baseline ProTrack**:
   - **379 Batches Pengajuan REAL**
   - **1.028 Line Items ACC REAL**
   - **Rp 4.303.052.418 Total Nilai ACC yang Disetujui (REAL)**
3. Berdasarkan aturan keselamatan:
   > *"DILARANG menghapus, truncate, atau mengubah data REAL/produksi."*  
   > *"Jika database yang terhubung adalah database REAL/produksi, BERHENTI. Jangan menjalankan operasi penghapusan."*
   
   Maka **operasi penghapusan / truncate pada database aktif `.env` DIBATALKAN / DIBLOKIR SECARA PENUH**.
4. Sesuai instruksi Tahap 2:
   > *"Sebagai gantinya, siapkan database pengujian terpisah dengan skema yang sesuai dan jelaskan langkah yang masih dibutuhkan."*
   
   Telah disiapkan **database pengujian terisolasi penuh** menggunakan teknologi cabang Neon (*copy-on-write branch*):
   - **Branch Name:** `test-import-sandbox` (`br-polished-flower-b3sqqris`)
   - **Isolated Endpoint:** `ep-proud-wave-b3jx3t35-pooler.c-4.ap-southeast-1.aws.neon.tech`
   - **Status Data Transaksional di Test Branch:** **KOSONG (0 Rows)**
   - **Status Master Data di Test Branch:** **UTUH (100% Siap Menerima Import Excel)**
   - **Status Database Produksi Utama:** **100% TIDAK TERSENTUH / TIDAK BERUBAH**

---

## 2. AUDIT LINGKUNGAN & KONEKSI DATABASE AKTUAL

| Parameter | Database Produksi Aktif (`.env`) | Database Pengujian Terpisah (`.env.test.local`) |
| :--- | :--- | :--- |
| **Penyedia / Platform** | Neon Serverless PostgreSQL (AWS Singapore `ap-southeast-1`) | Neon Serverless PostgreSQL (AWS Singapore `ap-southeast-1`) |
| **Neon Project ID** | `proud-violet-96345126` (`protrack-db`) | `proud-violet-96345126` (`protrack-db`) |
| **Branch** | `main` (`br-flat-sea-b3mobv1m`) | `test-import-sandbox` (`br-polished-flower-b3sqqris`) |
| **Endpoint Host** | `ep-super-feather-b3nya85u-pooler.c-4.ap-southeast-1.aws.neon.tech` | `ep-proud-wave-b3jx3t35-pooler.c-4.ap-southeast-1.aws.neon.tech` |
| **Direct Host** | `ep-super-feather-b3nya85u.c-4.ap-southeast-1.aws.neon.tech` | `ep-proud-wave-b3jx3t35.c-4.ap-southeast-1.aws.neon.tech` |
| **Database Name** | `neondb` | `neondb` |
| **User Role** | `neondb_owner` | `neondb_owner` |
| **Klasifikasi Data** | **DATA REAL / PRODUKSI KONSISTEN SEJAK PHASE 8C** | **DATA KHUSUS PENGUJIAN & UAT** |
| **Kebijakan Reset** | **DIBLOKIR TOTAL (TIDAK BOLEH DIHAPUS)** | **BERHASIL DIKOSONGKAN SECARA AMAN** |

---

## 3. AUDIT TABEL & STATUS DATA SEBELUM DAN SESUDAH

### 3.1 Pada Database Pengujian Terpisah (`test-import-sandbox`)

Tabel transaksional yang dikosongkan untuk kebutuhan pengujian import Excel dari nol:

| Tabel | Deskripsi | Baris Sebelum Reset | Baris Sesudah Reset | Status / Alasan |
| :--- | :--- | :---: | :---: | :--- |
| `submission_batches` | Batch pengajuan ACC dari voucher No Kas | 379 | **0** | **Dikosongkan** agar dapat diuji dari nol |
| `acc_expense_items` | Rincian item pengajuan biaya ACC | 1.028 | **0** | **Dikosongkan** agar dapat diuji dari nol |
| `disbursement_items` | Rincian realisasi pencairan | 0 | **0** | Kosong |
| `disbursements` | Transaksi pencairan kas/bank | 0 | **0** | Kosong |
| `fund_inflows` | Penerimaan dana modal/dropping | 0 | **0** | Kosong |
| `journal_lines` | Rincian baris jurnal debet/kredit | 0 | **0** | Kosong |
| `journal_entries` | Header pencatatan jurnal double-entry | 0 | **0** | Kosong |
| `expense_item_details` | Rincian operasional ekspansi (RAP detail) | 0 | **0** | Kosong |
| `vendor_contracts` | Kontrak vendor proyek | 0 | **0** | Kosong |
| `project_budgets` | Header RAP proyek | 0 | **0** | Kosong |
| `budget_items` | Rincian item anggaran RAP | 0 | **0** | Kosong |
| `project_termins` | Rencana termin pembayaran proyek | 0 | **0** | Kosong |
| `project_progress_logs` | Catatan kemajuan fisik proyek | 0 | **0** | Kosong |

### 3.2 Master Data & Autentikasi yang Dipertahankan pada Database Pengujian

| Tabel Master | Jumlah Baris | Alasan Dipertahankan |
| :--- | :---: | :--- |
| `projects` | **13** | Wajib ada sebagai target resolusi `projectId` saat parsing kolom Proyek di Excel. |
| `project_sub_units` | **16** | Wajib ada untuk memetakan sub-unit spesifik (SMA, SMP, SD, TK, SIPIL, dll). |
| `expense_categories` | **9** | Wajib ada untuk mapping kategori belanja (UPAH, MATERIAL, ALAT, dll). |
| `expense_sub_categories`| **27** | Wajib ada untuk resolusi sub-kategori pengeluaran. |
| `field_pics` | **8** | Wajib ada untuk memetakan PIC pengaju/koordinator lapangan (PA HERI, NISA, dll). |
| `cash_accounts` | **9** | Akun kas & bank operasional (Kas Sumedang, BCA, Mandiri, dll). |
| `coa_accounts` | **11** | Master bagan akun akuntansi untuk otomasi jurnal. |
| `category_coa_mappings`| **9** | Pemetaan aturan otomatisasi jurnal beban per kategori. |
| `cash_sequences` | **3** | Generator nomor urut kas. |
| `users` | **1** | Akun pengguna terdaftar (`nisa`, role: `STAFF`, aktif). |

---

## 4. STATUS BACKUP & DATA RECOVERY

1. **Neon Point-In-Time Restore (PITR) & Snapshot**:
   - Cabang utama produksi `main` memiliki snapshot aktif di Neon Console.
   - Cabang pengujian `test-import-sandbox` dibuat dari LSN `0/30D37A8` cabang `main`.
2. **Kemandirian Cabang (Branch Independence)**:
   - Karena Neon menggunakan arsitektur storage *Copy-on-Write*, seluruh operasi penulisan atau penghapusan pada cabang `test-import-sandbox` hanya memodifikasi delta penyimpanan cabang tersebut. Cabang `main` (produksi) terlindungi secara fisik pada level storage engine PostgreSQL.
3. **Integritas File Sumber**:
   - File Excel sumber `Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx` (637.945 bytes) berada di root direktori proyek, tidak dimodifikasi, dan siap digunakan untuk pengujian import.

---

## 5. HASIL VALIDASI LOGIN & KESIAPAN FITUR IMPORT

Pemeriksaan otomatis telah dijalankan melalui skrip verifikasi `scratch/validate-test-db-readiness.ts`:

1. **Kesiapan Autentikasi**:
   - Akun pengguna `nisa` (role: `STAFF`) tetap aktif di database pengujian.
   - Jumlah admin saat ini adalah 0, sehingga rute inisialisasi `/setup-admin` tetap dapat diakses dengan aman untuk membuat akun administrator baru di lingkungan pengujian tanpa merusak sistem.
2. **Kesiapan Resolusi Master Data Import**:
   - 13 Proyek, 16 Sub-Unit, 9 Kategori, 27 Sub-Kategori, dan 8 PIC telah siap melayani lookup fungsi `parseAndValidateExcel` dan `parseAndMapRealWorkbook`.
3. **Kesiapan Template Engine**:
   - Fungsi `generateAccImportTemplate()` berhasil memproduksi buffer template resmi Excel berukuran **8.349 bytes** tanpa error.
4. **Zero Regresi**:
   - Seluruh logika bisnis `acc.service.ts`, `balance.service.ts`, dan skema Prisma tetap utuh tanpa modifikasi kode aplikasi.

---

## 6. BUKTI DATABASE REAL TIDAK DIUBAH SAMA SEKALI

Cross-check langsung terhadap koneksi database produksi (`ep-super-feather-b3nya85u`) dilakukan sesudah proses reset cabang pengujian selesai:

```
==================================================================
AUDIT CROSS-CHECK: MEMASTIKAN DATABASE PRODUKSI 100% TIDAK BERUBAH
==================================================================
[PRODUKSI] Submission Batches : 379 (Ekspektasi Baseline: 379)       -> COCOK 100%
[PRODUKSI] ACC Expense Items  : 1028 (Ekspektasi Baseline: 1028)     -> COCOK 100%
[PRODUKSI] Total Approved     : Rp4.303.052.418                      -> COCOK 100%
[PRODUKSI] Master Projects    : 13                                   -> COCOK 100%
[PRODUKSI] Users              : 1                                    -> COCOK 100%

✅ VERIFIKASI SELESAI: Data REAL produksi 100% AMAN dan TIDAK BERUBAH!
```

**Kesimpulan:** Tidak ada satu pun baris data REAL di database produksi yang terhapus, terpotong (*truncated*), atau termutasi.

---

## 7. PANDUAN PENGGUNAAN LINGKUNGAN PENGUJIAN

Untuk menguji fitur import Excel pada kondisi database kosong yang telah disiapkan:

### Opsi A: Menggunakan `.env.test.local` (Direkomendasikan)
File `.env.test.local` telah disiapkan dan secara otomatis diabaikan oleh git:
```bash
# Salin konfigurasi pengujian ke .env sementara untuk uji coba lokal:
cp .env.test.local .env
```
*(Setelah pengujian selesai, `.env` dapat dikembalikan ke endpoint produksi).*

### Opsi B: Menguji Import melalui Skrip / CLI Langsung
Jalankan uji coba import dengan menyuntikkan `DATABASE_URL` dari database pengujian:
```bash
DATABASE_URL="postgresql://neondb_owner:npg_TDAv8c5zPCOn@ep-proud-wave-b3jx3t35-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" npm run dev
```

---

## 8. STATUS AKHIR

Sesuai taksonomi laporan:

* **Status Database Utama Terhubung (`.env`):**  
  **`BLOCKED — PRODUCTION DATABASE`**  
  *(Operasi reset dibatalkan untuk melindungi 379 batch dan 1.028 item REAL senilai Rp 4.303.052.418).*

* **Status Database Pengujian Terisolasi (`test-import-sandbox`):**  
  **`TEST DATABASE RESET COMPLETE`**  
  *(Kondisi data transaksional kosong, master data lengkap, user aman, siap untuk uji coba import Excel).*
