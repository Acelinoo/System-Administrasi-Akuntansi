# ProTrack Financial Rules & Service Logic

## 1. Pemisahan Empat Konsep Nominal
* **Requested Amount**: Nominal draf pengajuan awal yang diusulkan staf (opsional/informasional).
* **Approved Amount**: Nominal resmi yang disetujui atasan di luar sistem. Wajib $> 0$. Merupakan batas pagu (*ceiling*) kewajiban pencairan.
* **Realized Amount**: Nominal aktual yang keluar dari kas/bank saat pencairan dilakukan.
* **Journal Amount**: Nominal yang dibukukan ke dalam pembukuan resmi (selalu bersumber dari *Realized Amount*, bukan *Approved Amount*).

## 2. Rumus Saldo Kas & Bank
Saldo akun kas/bank dihitung secara deterministik dari riwayat transaksi berstatus `POSTED`:
$$\text{Saldo Akhir} = \text{Opening Balance} + \sum \text{Posted FundInflows} - \sum \text{Posted Disbursements}$$
* Transaksi berstatus `VOID` otomatis dikeluarkan dari agregasi saldo.
* **Insufficient Funds Rule**: Transaksi pencairan wajib ditolak jika $\text{Saldo Kas} < \text{Total Pencairan}$. Saldo negatif dilarang.

## 3. Aturan Partial Payment & Status ACC
Satu item ACC dapat dicairkan beberapa kali (multi-tranche) dengan aturan overpayment:
$$\sum \text{Realized Amount} \le \text{Approved Amount}$$
$$\text{Outstanding} = \text{Approved Amount} - \sum \text{Posted Realized Amount}$$

Status Lifecycle `AccExpenseItem`:
* `APPROVED`: $\sum \text{Realized} = 0$
* `PARTIALLY_REALIZED`: $0 < \sum \text{Realized} < \text{Approved Amount}$
* `FULLY_REALIZED`: $\sum \text{Realized} \ge \text{Approved Amount}$
* `CANCELLED`: Dibatalkan sebelum ada pencairan.

## 4. Integritas Total Pencairan (Zero Client-Trust)
Server menghitung ulang total dari rincian item:
$$\text{disbursement.totalRealizedAmount} = \sum \text{disbursement\_items.realizedAmount}$$
Jika nilai total yang dikirimkan klien tidak sama persis dengan hasil perhitungan server, transaksi ditolak seketika.

## 5. Otomasi Jurnal Pembukuan (Double-Entry)
Setiap transaksi finansial membentuk jurnal otomatis yang balance:
* **Pencairan (Disbursement)**:
  * **DEBET**: Akun Beban sesuai Kategori Operasional (`5101`, `5102`, `5103`, dll)
  * **KREDIT**: Akun Kas / Bank Asal Pembayaran (`1101` untuk CASH, `1102` untuk BANK)
* **Penerimaan Dana (Fund Inflow)**:
  * **DEBET**: Akun Kas / Bank Penerima (`1101` / `1102`)
  * **KREDIT**: Modal Operasional / Dropping Dana Atasan (`3101`)
* **Validasi Keseimbangan**:
  $$\sum \text{Debit} === \sum \text{Credit}$$
  Jika terjadi selisih bahkan Rp0,01, seluruh transaksi di-rollback secara utuh.

## 6. Mekanisme VOID (Reversal / Pembatalan)
* Data transaksi finansial berstatus `POSTED` tidak boleh dihapus dari database (*Zero Hard Delete*).
* Saat di-void:
  1. Status transaksi (`disbursements` / `fund_inflows`) berubah menjadi `VOID` dengan mencatat `voidedAt` dan `voidReason`.
  2. Jurnal terkait otomatis di-void.
  3. Status item ACC dihitung ulang secara otomatis berdasarkan sisa transaksi `POSTED` yang masih aktif.
  4. Saldo kas/bank otomatis pulih kembali secara instan.
