# PROTRACK — PANDUAN & CHECKLIST DEPLOYMENT PUBLIK
**Sistem Administrasi & Akuntansi Proyek**  
*Tanggal Rilis: 11 Oktober 2026*  
*Status Kesiapan: **READY FOR CONTROLLED PUBLIC DEPLOYMENT***  
*Basis Data: Neon Serverless PostgreSQL (`neondb`)*

---

## 1. Status Kesiapan Deployment Publik

Aplikasi ProTrack telah melewati rangkaian audit kode, verifikasi integritas finansial, eliminasi kebocoran Server Actions, penambahan rate limiter login (*brute-force defense*), serta sanitasi pesan error basis data.

| Area / Komponen | Status Aktual | Ringkasan Bukti & Hasil Uji |
| :--- | :---: | :--- |
| **Kompilasi & Build** | **READY (PASS)** | `npx tsc --noEmit` (Exit 0), `npm run lint` (0 error, 0 warning), `npm run build` (Exit 0, seluruh 32 rute Next.js 16 App Router terkompilasi optimal). |
| **Layer Autentikasi** | **READY (PASS)** | Password hashing `scrypt` + 16-byte random salt, HMAC-SHA256 session token, cookie `protrack_session` (*HttpOnly, SameSite=Lax, Secure di prod*). |
| **Proteksi Brute-Force** | **READY (PASS)** | In-memory sliding window rate limiter: Maksimal 5 percobaan gagal per 15 menit per client IP / username. Percobaan ke-6 dikunci otomatis selama 15 menit (**PASS** pada uji aktual). |
| **Server-Side Authorization (Zero Trust)** | **READY (PASS)** | Seluruh Server Actions dan API routes dilindungi `requireAuth()` dan `requireAdmin()`. Mutasi keuangan dan VOID mengikat identitas dari sesi server, bukan parameter client. |
| **Sanitasi Error & Anti-Leakage** | **READY (PASS)** | Error database (Prisma / Neon / SQL hostnames) dimask otomatis oleh `sanitizeErrorMessage`. Endpoint `/api/health` tidak mengekspos detail koneksi internal. |
| **Anti-Takeover `/setup-admin`** | **READY (PASS)** | `getAdminCount()` menghitung seluruh admin historis, dibungkus dalam `prisma.$transaction` atomik. Tidak dapat digunakan kembali setelah admin dibuat. |
| **Integritas Data REAL** | **100% IMMUTABLE** | 379 Batch ACC, 1.028 Item ACC, Rp4.303.052.418 approved total, Rp0 pencairan REAL, Rp0 inflow REAL, 0 baris jurnal REAL. 0 residu test. |

---

## 2. Daftar Masalah & Catatan yang Masih Tersisa

Meskipun secara aplikasi kode telah siap dan aman, terdapat catatan operasional yang wajib dipahami pengelola sistem:

1. **Stateless Token Expiry pada Reset Password:**
   * Token sesi berbasis HMAC-SHA256 bersifat *stateless* dengan masa aktif 7 hari. Reset password di database tidak serta-merta membatalkan token yang telah dipegang browser hingga masa berlakunya habis.
   * *Mitigasi:* Jika ada staf yang dicurigai atau resign, Admin dapat menonaktifkan akun tersebut (`isActive: false`). Guard `getCurrentUser()` akan seketika menolak setiap akses dan menghapus cookie pada request berikutnya.
2. **Holding State Data Excel Historis (723 Item Mandor & 6 Proyek Kandidat):**
   * Terdapat 723 item berstatus `UNASSIGNED_MANDOR` dari arsip data historis. Kasir harus menetapkan PIC sebelum voucher dicairkan.
   * Terdapat 6 proyek dengan status `REQUIRES_BUSINESS_CONFIRMATION` yang membutuhkan persetujuan kontrak bisnis manajemen sebelum RAP ditetapkan.
3. **Fluktuasi Koneksi Cold-Start Pooler Neon:**
   * Pada jaringan serverless Neon dengan connection pooling (`pgbouncer=true`), instance pooler yang baru bangun (*wake-up*) membutuhkan waktu ~1-2 detik. Gunakan connection pooling aktif di platform hosting produksi.

---

## 3. Variabel Environment yang Wajib Disiapkan di Platform Hosting

Jangan pernah menyertakan file `.env` ke dalam git repository. Konfigurasikan variabel lingkungan berikut secara aman pada dashboard hosting (misal Vercel / Railway / Cloudflare / Docker):

| Nama Variabel | Tipe / Contoh Format | Keterangan & Persyaratan |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@ep-pooler.region.neon.tech/neondb?sslmode=require&pgbouncer=true` | **Wajib**. Connection string PostgreSQL pooler untuk query transaksi harian aplikasi. |
| `DIRECT_URL` | `postgresql://user:pass@ep-direct.region.neon.tech/neondb?sslmode=require` | **Wajib**. Connection string langsung (*non-pooler*) untuk migrasi Prisma & DDL. |
| `NODE_ENV` | `production` | **Wajib**. Mengaktifkan flag cookie `secure: true` dan mematikan stack trace development. |
| `AUTH_SECRET` | `String acak minimal 64 karakter base64` | **Wajib**. Kunci enkripsi penandatanganan HMAC-SHA256 sesi token. Dilarang menggunakan default secret! |

### Cara Menghasilkan `AUTH_SECRET` yang Kuat:
Jalankan perintah ini di terminal lokal Anda (PowerShell / Bash):
```bash
# Menggunakan Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Atau menggunakan OpenSSL
openssl rand -base64 48
```
Salin string hasil keluaran dan tempelkan sebagai nilai variabel `AUTH_SECRET` di environment hosting Anda.

---

## 4. Langkah Deployment Rekomendasi (Vercel + Neon)

Platform yang direkomendasikan adalah **Vercel** untuk serverless frontend/API Next.js 16 dan **Neon** untuk basis data PostgreSQL serverless.

### Langkah 1: Persiapan Repository & Sinkronisasi
1. Pastikan seluruh perubahan kode lokal terverifikasi bersih (`git status`).
2. Buat commit bersih dari branch kerja dan push ke remote repository privat (GitHub/GitLab).

### Langkah 2: Impor Project ke Vercel
1. Masuk ke dashboard [Vercel](https://vercel.com) dan pilih **"Add New Project"**.
2. Pilih repositori ProTrack Anda.
3. Framework Preset: **Next.js** (Otomatis terdeteksi).
4. Build Command: `npm run build` (atau `next build`).
5. Output Directory: `.next` (default).

### Langkah 3: Input Environment Variables
Pada bagian **Environment Variables** di Vercel, tambahkan 4 variabel wajib dari Bagian 3:
* `DATABASE_URL`
* `DIRECT_URL`
* `NODE_ENV` = `production`
* `AUTH_SECRET` = `[String acak 64 karakter hasil generate]`

### Langkah 4: Sinkronisasi Skema Database (Prisma Deploy)
Sebelum traffic diarahkan, jalankan sinkronisasi skema dari lokal atau build command:
```bash
npx prisma db push
```
*Catatan:* Model `User` sudah tersinkronkan pada basis data Neon saat ini tanpa mengubah data transaksi finansial REAL.

### Langkah 5: Pasang Cloudflare WAF (Sangat Direkomendasikan untuk Publik Internet)
Jika domain publik Anda diarahkan melalui Cloudflare (DNS Proxy aktif):
1. Masuk ke menu **Security -> WAF -> Rate Limiting Rules**.
2. Buat aturan baru:
   * **Rule Name:** `ProTrack Login Protection`
   * **Matching URL:** `Hostname equals your-protrack-domain.com AND URI Path equals /login`
   * **Rate Limit:** 10 request per 1 menit per IP.
   * **Action:** Block atau Managed Challenge.
3. Aktifkan **Bot Fight Mode** di Cloudflare untuk memfilter crawling bot liar.

---

## 5. Prosedur Inisialisasi Akun Admin Pertama

Saat aplikasi pertama kali aktif di URL publik (contoh: `https://protrack.perusahaan.com`):

1. **Buka Halaman Setup Admin:**
   * Arahkan browser langsung ke: `https://[domain-anda]/setup-admin`.
2. **Form Setup Awal Terbuka:**
   * Masukkan **Username Pimpinan / Administrator** (minimal 3 karakter).
   * Masukkan **Nama Lengkap**.
   * Masukkan **Password** (minimal 8 karakter kombinasi huruf, angka, simbol).
   * Masukkan **Konfirmasi Password**.
3. **Klik "Inisialisasi Akun Administrator":**
   * Sistem akan memvalidasi secara atomik di dalam database transaction.
   * Akun Admin dibuat dengan role `ADMIN`.
   * Cookie sesi langsung diterbitkan, dan Anda dialihkan ke Dashboard utama.
4. **Penguncian Permanen:**
   * Akses ke `/setup-admin` **segera dikunci permanen**.
   * Jika ada orang lain mencoba membuka `/setup-admin`, mereka akan dialihkan otomatis ke `/login`.
   * Upaya pemanggilan `setupInitialAdmin` lewat API/cURL akan ditolak dengan pesan: *"Sistem telah memiliki Administrator. Fitur setup awal ditutup."*

---

## 6. Prosedur Menguji Login & Hak Akses (UAT Pasca-Deploy)

Setelah Admin pertama berhasil dibuat:

### Uji 1: Pembuatan Akun Staf Operasional (Kasir)
1. Login sebagai Administrator.
2. Buka menu samping: **MASTER DATA -> Pengguna** (`/master/users`).
3. Tambah pengguna baru:
   * Username: `kasir_lapangan`
   * Nama: `Staf Kasir 1`
   * Role: Pilih **STAFF (Kasir / Operasional)**
   * Password: Buat password sementara (min 8 karakter).
4. Klik **Simpan Pengguna**.

### Uji 2: Verifikasi Hak Akses STAFF
1. Buka jendela browser penyamaran (*Incognito / Private Window*).
2. Buka `https://[domain-anda]/login` dan masuk menggunakan akun `kasir_lapangan`.
3. Coba lakukan operasi yang **diizinkan**:
   * Melihat Dashboard, Rekap ACC, Laporan Keuangan, dan Ekspor Excel (**Harus Berhasil**).
   * Membuka form input ACC draf (**Harus Berhasil**).
4. Coba akses menu atau aksi khusus **ADMIN**:
   * Coba buka menu `/master/users` (**Harus ditolak / redirect**).
   * Coba lakukan pembatalan/VOID pada transaksi (**Harus ditolak dengan pesan Administrator**).

### Uji 3: Uji Proteksi Rate Limiting Login
1. Pada halaman login, masukkan username asal dengan password salah sebanyak 5 kali berturut-turut.
2. Pada percobaan ke-6, sistem harus menolak dengan pesan:
   * *"Terlalu banyak percobaan login yang gagal. Akses sementara dikunci selama ... detik."*
3. Tunggu masa lockout berakhir sebelum mencoba kembali.

---

## 7. Prosedur Backup & Rollback (Disaster Recovery Plan)

### A. Snapshot Harian & Point-in-Time Restore (Neon)
Neon menyediakan fitur branching instan tanpa downtime:
1. Sebelum melakukan pembaruan versi aplikasi besar, buka dashboard Neon:
   * Pilih branch produksi -> klik **Create Branch** -> beri nama `backup_pre_deploy_[tanggal]`.
2. Jika terjadi insiden integritas data:
   * Ubah pointer Vercel `DATABASE_URL` ke branch snapshot tersebut, atau pulihkan data menggunakan point-in-time restore.

### B. Backup Manual via `pg_dump`
Eksekusi dari terminal aman dengan akses ke `DIRECT_URL`:
```bash
# Backup baseline produksi
pg_dump "$DIRECT_URL" -Fc -v -f "protrack_backup_$(date +%Y%m%d_%H%M%S).dump"

# Rollback pemulihan database
pg_restore -d "$DIRECT_URL" -c -v "protrack_backup_[timestamp].dump"
```

### C. Verifikasi Integritas Pasca-Rollback
Setelah melakukan rollback, verifikasi bahwa baseline tidak berubah dengan menjalankan skrip audit terisolasi:
```bash
npx tsx tests/phase9-production-readiness.ts
```
Pastikan seluruh assertions menyatakan **PASS** (379 Batches, 1028 Items, Rp4.303.052.418 approved, Rp0 realized).

---

## 8. Tindakan Manual yang Masih Diperlukan (Action Items Manajemen)

Berikut daftar langkah yang memerlukan keputusan manual dari manajemen perusahaan sebelum aplikasi beroperasi penuh:

- [ ] **Generate & Pasang `AUTH_SECRET`:** Buat kunci rahasia 64 karakter untuk variabel hosting produksi.
- [ ] **Pemberian Kredensial Admin:** Tetapkan pimpinan/manajer yang berhak mendaftarkan akun admin pertama di `/setup-admin`.
- [ ] **Daftarkan Akun Staf:** Buat akun untuk masing-masing kasir dan staf administrasi melalui menu `/master/users`.
- [ ] **Penyelesaian 723 Item Mandor:** Kasir/Admin mengonfirmasi penetapan nama mandor lapangan saat pencairan voucher diproses.
- [ ] **Konfirmasi 6 Proyek Kandidat:** Manajemen mengonfirmasi status kontrak untuk DARUL_ULUM, BUDI_INDAH, APARTEMEN, ANTAPANI, CIREBON, dan JL_GITAR.
- [ ] **Aktivasi Cloudflare WAF:** Konfigurasikan pembatasan rate limit 10 req/menit pada domain publik.
