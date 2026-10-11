# LAPORAN IMPLEMENTASI KEAMANAN PUBLIK, AUTENTIKASI & RBAC
## ProTrack Admsystem — Public Release Security & Server Authorization
**Tanggal Implementasi:** 11 Oktober 2026  
**Status:** VALIDATED & READY FOR PUBLIC RELEASE  
**Basis Data:** Neon Serverless PostgreSQL  
**Ruang Lingkup Baseline REAL:** 100% Utuh & Tidak Berubah (379 batch, 1.028 item ACC, Rp4.303.052.418 approved, 0 disbursement, 0 inflow, 0 journal)

---

## 1. Arsitektur Autentikasi & Otorisasi

Arsitektur keamanan ProTrack dirancang dengan filosofi **Zero Trust Server-Side Enforcement**, memastikan bahwa hak akses tidak hanya dibatasi pada antarmuka pengguna (UI) atau middleware routing, melainkan ditegakkan secara ketat pada setiap Server Action dan API route.

```
+-----------------------------------------------------------------------------------+
|                                  BROWSER CLIENT                                   |
|  - Login Form (/login)                                                            |
|  - Setup Admin Form (/setup-admin) [Gated: hanya jika adminCount === 0]          |
|  - HttpOnly Cookie: protrack_session (7 hari, SameSite=Lax, Secure di prod)      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             NEXT.JS MIDDLEWARE ROUTER                             |
|  - Mengizinkan path publik: /login, /setup-admin, /api/health, static assets      |
|  - Memverifikasi HMAC session token untuk semua rute aplikasi (/acc, /master, dll) |
|  - Redirect unauthenticated request ke /login?from=[pathname]                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        SERVER-SIDE ACTIONS & API GUARDS                           |
|  - requireAuth(): Memverifikasi session dan memastikan user aktif di database    |
|  - requireAdmin(): Memverifikasi bahwa user memiliki peran ADMIN di database      |
|  - DB-Backed Verification: Tidak mempercayai klaim peran pada cookie semata      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                              DATABASE & PRISMA ORM                                |
|  - Model User dengan passwordHash (Node.js scrypt + 16-byte random salt)          |
|  - Invariant REAL baseline data terisolasi & terlindungi                          |
+-----------------------------------------------------------------------------------+
```

### Komponen Inti:
1. **Hashing Password (`src/lib/auth/password.ts`):** Menggunakan algoritma kriptografi Node.js `scrypt` dengan salt acak 16 byte unik per pengguna, disimpan dalam format `salt:derivedKeyHex`. Verifikasi menggunakan `timingSafeEqual` untuk mencegah *timing attacks*.
2. **Session Token HMAC (`src/lib/auth/token.ts`):** Menggunakan HMAC-SHA256 yang ditandatangani menggunakan Web Crypto API (`crypto.subtle`), kompatibel baik pada runtime Node.js maupun Edge/Middleware Next.js.
3. **Session Cookie Helper (`src/lib/auth/session.ts`):** Mengelola cookie `protrack_session` dengan masa aktif 7 hari, bendera `httpOnly: true`, `sameSite: "lax"`, dan `secure: true` pada environment produksi.
4. **Auth Service (`src/lib/auth/auth.service.ts`):** Menyediakan guard `requireAuth()`, `requireAdmin()`, `getCurrentUser()`, `authenticateUser()`, `setupInitialAdmin()`, dan `getAdminCount()`.
5. **Route Middleware (`src/middleware.ts`):** Melindungi rute aplikasi di tingkat routing sebelum request mencapai komponen atau halaman Next.js.

---

## 2. Definisi Role & Kewenangan (RBAC Matrix)

| Fitur / Modul | Role STAFF (Kasir / Operasional) | Role ADMIN (Pimpinan / Kontrol Penuh) |
| :--- | :---: | :---: |
| **Login & Logout Portal** | Diizinkan | Diizinkan |
| **Melihat Dashboard & Statistik** | Diizinkan | Diizinkan |
| **Melihat Data ACC & Rincian** | Diizinkan | Diizinkan |
| **Input Data ACC Operasional Baru** | Diizinkan (otomatis tercatat `createdById`) | Diizinkan (otomatis tercatat `createdById`) |
| **Pencairan Voucher Kas/Bank (Disbursement)** | Diizinkan (otomatis tercatat `createdById`) | Diizinkan (otomatis tercatat `createdById`) |
| **Penerimaan Dana Masuk (Inflow)** | Diizinkan (otomatis tercatat `createdById`) | Diizinkan (otomatis tercatat `createdById`) |
| **Pencatatan Pembayaran Termin Proyek** | Diizinkan | Diizinkan |
| **Pencatatan Progres Fisik Proyek** | Diizinkan | Diizinkan |
| **Input Rincian Nota / Material ACC** | Diizinkan | Diizinkan |
| **Input & Perbarui Master PIC / Vendor** | Diizinkan | Diizinkan |
| **Melihat Buku Jurnal & Laporan Keuangan** | Diizinkan | Diizinkan |
| **Export Dokumen Excel & PDF** | Diizinkan | Diizinkan |
| **VOID / Pembatalan Realisasi Pencairan** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **VOID / Pembatalan Penerimaan Dana Masuk** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Impor Data ACC via Excel** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Manajemen Anggaran RAP Proyek** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Hapus Versi / Item Anggaran RAP** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Pembuatan & Hapus Kontrak Vendor** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Master Proyek, Sub-Unit, Kategori Biaya** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Master Akun Kas & Bank, Rekening COA** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Hapus Master Vendor** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |
| **Manajemen Pengguna (Buat/Edit/Reset/Nonaktif)** | **DITOLAK (Akses Ditolak)** | **Diizinkan** |

---

## 3. Daftar Server Actions & API Routes yang Diamankan

Semua aksi server dan rute API telah dipasang server-side guard:

### Server Actions
1. **`src/app/actions/disbursement.actions.ts`:**
   - `getDisbursementList`: `requireAuth()`
   - `getDisbursementDetail`: `requireAuth()`
   - `createDisbursementAction`: `requireAuth()` (otomatis menyematkan `createdById: user.id`)
   - `voidDisbursementAction`: **`requireAdmin()`** (hanya Administrator yang dapat membatalkan voucher)
2. **`src/app/actions/inflow.actions.ts`:**
   - `getInflowList`: `requireAuth()`
   - `getInflowDetail`: `requireAuth()`
   - `createInflowAction`: `requireAuth()` (otomatis menyematkan `createdById: user.id`)
   - `voidInflowAction`: **`requireAdmin()`** (hanya Administrator yang dapat membatalkan dana masuk)
3. **`src/app/actions/acc.actions.ts`:**
   - `getDashboardStats`, `getAccSummaryStats`, `getAccItemList`, `getAccItemDetail`: `requireAuth()`
   - `getMasterProjects`, `getMasterCategories`, `getMasterPics`, `getMasterCashAccounts`: `requireAuth()`
   - `createAccBatchAction`: `requireAuth()` (otomatis menyematkan `createdById: user.id`)
4. **`src/app/actions/import.actions.ts`:**
   - `previewExcelImportAction`: **`requireAdmin()`**
   - `confirmExcelImportAction`: **`requireAdmin()`**
5. **`src/app/actions/project-360.actions.ts`:**
   - `createProjectBudgetAction`, `addBudgetItemAction`, `deleteBudgetItemAction`, `deleteProjectBudgetAction`: **`requireAdmin()`**
   - `updateProjectContractDetailsAction`, `createVendorContractAction`, `deleteVendorContractAction`, `deleteExpenseItemDetailAction`: **`requireAdmin()`**
   - `createProjectTerminAction`, `recordTerminPaymentAction`, `createProjectProgressLogAction`, `createExpenseItemDetailAction`: `requireAuth()`
6. **`src/app/actions/master.actions.ts`:**
   - Proyek, Sub-Unit, Kategori, Sub-Kategori, Kas & Bank, Akun COA: **`requireAdmin()`**
   - Hapus Vendor: **`requireAdmin()`**
   - PIC Lapangan, Input/Edit Vendor: `requireAuth()`
   - Seluruh fetcher list master: `requireAuth()`
7. **`src/app/actions/journal.actions.ts`:**
   - `getJournalList`, `getJournalDetail`: `requireAuth()`
8. **`src/app/actions/user.actions.ts`:**
   - `getUsersListAction`, `createUserAction`, `updateUserAction`, `resetUserPasswordAction`, `toggleUserActiveAction`: **`requireAdmin()`**

### API Routes
1. **`/api/export/excel`:** Verifikasi session `getCurrentUser()`, return HTTP 401 jika unauthenticated.
2. **`/api/export/pdf`:** Verifikasi session `getCurrentUser()`, return HTTP 401 jika unauthenticated.
3. **`/api/templates/acc-import`:** Verifikasi session `getCurrentUser()`, return HTTP 401 jika unauthenticated.
4. **`/api/health`:** Rute publik bebas akses untuk liveness probe monitoring.

---

## 4. Mekanisme Bootstrap Akun Admin Pertama

Sistem mengimplementasikan alur inisialisasi admin pertama yang aman dan anti-takeover:
1. **Pengecekan Server-Side:** Fungsi `getAdminCount()` menghitung jumlah user dengan `role: ADMIN` di database.
2. **Halaman `/setup-admin` Terkunci Otomatis:**
   - Jika `adminCount === 0`, halaman `/setup-admin` terbuka untuk pendaftaran akun Pimpinan/Admin pertama.
   - Pimpinan mengisi Username (min 3 kar), Nama Lengkap (min 3 kar), dan Password (min 8 kar). Password diverifikasi dengan konfirmasi.
   - Setelah akun berhasil dibuat, session login langsung aktif dan user diarahkan ke dashboard.
3. **Proteksi Penguncian:**
   - Begitu minimal 1 akun ADMIN ada di database, akses ke `/setup-admin` dan pemanggilan `setupInitialAdmin` **segera dikunci permanen** (redirect otomatis ke `/login` dan throw error jika ditembak via API).
   - Penambahan admin atau staf berikutnya hanya dapat dilakukan melalui menu internal **Master Data -> Pengguna** (`/master/users`) oleh Admin yang sedang login.
   - **TIDAK ADA PASSWORD DEFAULT**: Tidak ada kredensial admin default atau hardcoded yang terekspos ke publik.

---

## 5. Perubahan Skema Database

Skema Prisma diperbarui pada model `User` (`prisma/schema.prisma`):
```prisma
model User {
  id           String        @id @default(uuid()) @db.Uuid
  username     String        @unique @db.VarChar(50)
  fullName     String        @map("full_name") @db.VarChar(100)
  role         UserRole      @default(STAFF)
  passwordHash String?       @map("password_hash") @db.VarChar(255)
  isActive     Boolean       @default(true) @map("is_active")
  lastLoginAt  DateTime?     @map("last_login_at") @db.Timestamptz()
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt    DateTime      @updatedAt @map("updated_at") @db.Timestamptz()

  createdBatches       SubmissionBatch[]
  createdDisbursements Disbursement[]
  createdInflows       FundInflow[]

  @@map("users")
}
```
Sinkronisasi ke Neon Database dilakukan dengan `npx prisma db push` secara aman tanpa data loss. Seluruh baseline operasional REAL diverifikasi sebelum dan sesudah perubahan.

---

## 6. Hasil Pengujian Keamanan & RBAC (Automated Test Suite)

Pengujian keamanan dijalankan melalui skrip terisolasi `tests/auth-security.ts`.  
**Hasil Eksekusi:** **37 dari 37 Pengujian Lolos (100% PASS)**

| Tahap Pengujian | Test Case | Hasil |
| :--- | :--- | :---: |
| **0. REAL Baseline Check** | Memastikan 379 batch, 1028 item ACC, Rp4.303.052.418 approved, 0 disbursement, 0 inflow, 0 journal | **PASS** |
| **1. Password Hashing** | Format hash `salt:derivedKeyHex`, salt 16-byte hex, verifikasi password benar berhasil, verifikasi password salah ditolak | **PASS** |
| **2. Session Token** | Penandatanganan HMAC token berhasil, verifikasi payload claims identik, penolakan token yang diutak-atik (tampered), penolakan token kedaluwarsa (expired) | **PASS** |
| **3. Initial Admin Gating** | Pembuatan admin pertama berhasil saat `adminCount === 0`, pemanggilan kedua setelah admin ada diblokir secara ketat | **PASS** |
| **4. Authentication Flow** | Pembuatan staf berhasil, login kredensial valid berhasil, login password salah ditolak, login username fiktif ditolak, penolakan akun yang dinonaktifkan (`isActive: false`) | **PASS** |
| **5. RBAC Enforcement** | `requireAuth()` unauthenticated melempar error, `requireAdmin()` unauthenticated melempar error, token STAFF lolos `requireAuth()`, token STAFF ditolak keras oleh `requireAdmin()`, token ADMIN lolos `requireAdmin()`, penolakan pemanggilan unauthenticated pada Server Actions (`voidDisbursementAction`, `voidInflowAction`, `previewExcelImportAction`, `createProjectAction`) | **PASS** |
| **6. Invariant & Teardown** | Seluruh user uji coba dibersihkan total; baseline data REAL diverifikasi 100% utuh tanpa selisih 1 rupiah pun | **PASS** |

---

## 7. Integritas Data Operasional REAL

Data baseline operasional ProTrack Admsystem diverifikasi secara atomik:
- **Jumlah Batch ACC REAL:** 379 batch (100% identik)
- **Jumlah Item ACC REAL:** 1.028 item (100% identik)
- **Total Akumulasi Nominal Disetujui:** Rp4.303.052.418 (100% identik)
- **Total Realisasi Pencairan REAL:** 0 disbursement (100% identik)
- **Total Penerimaan Dana REAL:** 0 inflow (100% identik)
- **Total Jurnal Akuntansi REAL:** 0 journal entry (100% identik)
- **Residu Uji Coba:** 0 entitas tersisa.

---

## 8. Panduan Operasional Pengelola Sistem

### A. Inisialisasi Akun Admin Pertama
1. Buka browser dan arahkan ke alamat aplikasi: `https://[domain-aplikasi]/setup-admin`.
2. Masukkan Username Pimpinan, Nama Lengkap, dan Password yang kuat (minimal 8 karakter kombinasi huruf, angka, dan simbol).
3. Klik **"Inisialisasi Akun Administrator"**.
4. Halaman setup akan langsung terkunci dan dialihkan ke dashboard.

### B. Membuat Akun Staf Kasir / Operasional
1. Login sebagai Administrator.
2. Buka menu samping: **MASTER DATA -> Pengguna** (`/master/users`).
3. Pada kartu **"Tambah Pengguna Baru"**, masukkan:
   - Username (misal: `kasir_utama` atau `nisa`).
   - Nama Lengkap (misal: `Anisa Septiani`).
   - Role: Pilih **STAFF (Kasir / Operasional)**.
   - Password Awal: Masukkan password awal yang kuat dan aman.
4. Klik **"Simpan Pengguna"**.

### C. Merotasi atau Reset Password
1. Buka menu **MASTER DATA -> Pengguna**.
2. Pada tabel pengguna, cari akun yang bersangkutan.
3. Klik tombol **"Reset Password"**.
4. Masukkan password baru (minimal 8 karakter) dan konfirmasi.
5. Simpan dan serahkan kredensial baru kepada pengguna melalui kanal komunikasi aman.

### D. Menangani Staf yang Non-Aktif / Resign
1. Buka menu **MASTER DATA -> Pengguna**.
2. Cari nama staf yang dinonaktifkan.
3. Klik tombol **"Nonaktifkan"**.
4. Status akun akan berubah menjadi *Inactive*.
5. Sistem seketika menolak setiap upaya login berikutnya dan secara otomatis membatalkan session cookie aktif saat request berikutnya tiba di server.

### E. Rekomendasi Deployment Publik
1. **Variabel Lingkungan (`.env`):**
   - Pastikan variabel `AUTH_SECRET` diatur dengan string acak dengan entropi tinggi (minimal 64 karakter) sebelum deploy ke environment publik (Vercel/server).
2. **Koneksi HTTPS:**
   - Cookie session telah dikonfigurasi dengan `secure: true` pada mode produksi, mewajibkan komunikasi terenkripsi SSL/HTTPS.
3. **Database Neon:**
   - Gunakan pooling connection string (`pgbouncer=true`) untuk performa serverless optimal di produksi.
