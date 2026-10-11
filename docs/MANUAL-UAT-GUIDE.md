# PANDUAN PENGUJIAN MANUAL (UAT BROWSER) — PROTRACK FASE 4 & 5
## Verifikasi Terisolasi Alur Pencairan Kas, Pengendalian Saldo, Jurnal & Pelaporan

**Workspace:** `C:\Marchelino Kurniawan\Project-2026\Admsystem`  
**Aplikasi Lokal:** `http://localhost:3000`  
**Status:** **MODE UJI COBA TERISOLASI AKTIF (`dataScope: TEST`)**  

---

## 1. Laporan Audit Mekanisme Keamanan `dataScope`

Berdasarkan audit menyeluruh terhadap kode antarmuka UI, Server Actions, dan Service layer:

### A. Temuan Gap Keamanan Awal di UI Browser:
1. **Default Fallback REAL**: Formulir bawaan aplikasi (`/disbursements/new`, `/inflows`, `/acc/new`) sebelumnya tidak menyertakan input `dataScope` pada `FormData`. Ketika disubmit, nilai `dataScope` bernilai `undefined`, yang secara otomatis jatuh ke `DataScope.REAL` pada layer service.
2. **Ketiadaan Filter Scope di Halaman Operasional**: Halaman `/disbursements/new` dan `/disbursements` sebelumnya memuat data tanpa filter scope sehingga selalu memuat 1.028 item ACC `REAL`. Jika pengguna menguji pencairan melalui URL biasa (`/disbursements/new`), transaksi tersebut **berisiko mencemari data REAL**.

### B. Solusi Pengamanan Lingkungan UAT Terisolasi:
Agar pengguna dapat menguji seluruh fungsi pencairan secara nyata di browser tanpa menyentuh data REAL:
1. **Enforcement Query Scope (`?scope=TEST`)**:
   - Halaman `/disbursements/new?scope=TEST` telah dikonfigurasi untuk hanya memuat item ACC bertanda `dataScope: TEST` dan saldo akun uji coba TEST. Data REAL (1.028 item senilai Rp4,3M) **100% disembunyikan dan diisolasi**.
   - Komponen formulir `DisbursementNewForm` menyuntikkan `formData.set("dataScope", "TEST")` secara wajib saat form disubmit di bawah mode ini.
   - Halaman menampilkan badge kuning jelas: `MODE UJI COBA (dataScope: TEST)` dan banner peringatan isolasi data.
2. **Halaman Pendukung Terisolasi**:
   - `/disbursements?scope=TEST`: Hanya menampilkan riwayat voucher pencairan uji coba TEST.
   - `/inflows?scope=TEST`: Hanya menampilkan dropping dana TEST dan formulir input bertanda TEST.
   - `/journals?scope=TEST`: Hanya menampilkan ayat jurnal umum bertanda TEST.
   - `/reports/projects?scope=TEST`: Hanya mengagregasi biaya proyek uji coba TEST.
3. **Script Setup & Cleanup Otomatis**:
   - `npx tsx scratch/seed-uat-test-data.ts`: Menyiapkan 1 rekening bank uji coba (`TEST-BANK-UAT`), 1 dropping dana Rp50.000.000, dan 1 item ACC uji coba `KT.TEST.901` senilai Rp10.000.000.
   - `npx tsx scratch/cleanup-uat-test-data.ts`: Menghapus seluruh data TEST setelah seluruh sesi UAT selesai dan memverifikasi invarian baseline REAL tetap 100% utuh.

---

## 2. Baseline Invarian REAL yang Wajib Terjaga
- **Submission Batches**: 379
- **ACC Items**: 1.028
- **Total Approved Amount**: Rp4.303.052.418
- **UNASSIGNED_MANDOR Items**: 723
- **Posted Disbursements REAL**: 0
- **Posted Fund Inflows REAL**: 0
- **Journal Entries REAL**: 0
- **Project Budget Records REAL**: 0

---

## 3. Matriks Skenario UAT Manual Browser

| No | Kode Tes | Skenario Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | **UAT-01** | **Pencairan Melebihi Sisa Outstanding ACC** | Input nominal > outstanding ditolak di browser & server dengan alert error jelas. |
| 2 | **UAT-02** | **Pencairan Melebihi Saldo Kas/Bank Pembayar** | Input nominal > saldo kas rekening ditolak dengan peringatan saldo tidak cukup. |
| 3 | **UAT-03** | **Pencairan Sebagian (Tranche 1: Rp4.000.000)** | Voucher terposting, saldo kas berkurang Rp4M, item ACC berstatus `Sebagian Cair`, sisa outstanding Rp6M. |
| 4 | **UAT-04** | **Pencairan Pelunasan (Tranche 2: Rp6.000.000)** | Voucher kedua terposting, status item ACC berubah menjadi `Lunas (FULLY_REALIZED)`, sisa outstanding Rp0. |
| 5 | **UAT-05** | **Verifikasi Saldo Akhir Kas & Bank** | Saldo rekening kas/bank pembayar berkurang tepat sebesar total yang dicairkan (Rp50M - Rp10M = Rp40M). |
| 6 | **UAT-06** | **Verifikasi Keseimbangan Jurnal Double-Entry** | Halaman Jurnal Umum menampilkan Debet (Beban Material) = Rp10.000.000 dan Kredit (Bank) = Rp10.000.000 (Balanced). |
| 7 | **UAT-07** | **Verifikasi Rekap Proyek (Zero Double-Counting)** | Laporan proyek menampilkan realisasi biaya tepat Rp10.000.000 tanpa penggandaan baris. |
| 8 | **UAT-08** | **Verifikasi Ekspor Excel & PDF Proyek** | File PDF dan Excel terunduh dengan angka konsisten, tanpa artefak karakter font `!³`. |
| 9 | **UAT-09** | **Pembatalan Transaksi (VOID) & Pemulihan Saldo** | Pembatalan voucher memulihkan saldo kas/bank dan mengembalikan status ACC secara akurat. |
| 10 | **UAT-10** | **Pembersihan Bersih (Cleanup TEST Data)** | Seluruh record TEST dibersihkan tanpa sisa; baseline REAL diverifikasi 100% identik. |

---

## 4. Eksekusi Tes Perdana: UAT-01 (Penolakan Overpayment)

*(Instruksi detail langkah demi langkah disampaikan pada laporan dialog)*
