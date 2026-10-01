# ProTrack Database Documentation

## 1. Overview
Database ProTrack dibangun di atas PostgreSQL menggunakan Prisma ORM dengan konfigurasi Cloud-Native via Neon Serverless Postgres. Seluruh tabel menggunakan UUID sebagai Primary Key, Timestamp dengan Timezone (`TIMESTAMPTZ`), dan Foreign Key dengan integritas referensial ketat (`ON DELETE RESTRICT`).

## 2. Table Summary

| Table Name | Description | Key Constraints |
|---|---|---|
| `users` | Akun pengguna internal (staf admin) & audit trail | `UNIQUE(username)` |
| `cash_sequences` | Atomic sequential generator untuk No Kas KU & KT | `PRIMARY KEY(prefix, year)` |
| `projects` | Master Proyek Induk (Parent Project) | `UNIQUE(code)` |
| `project_sub_units` | Master Sub-unit / Anak Proyek | `UNIQUE(id, projectId)`, `UNIQUE(projectId, code)` |
| `expense_categories` | Kategori Operasional Lapangan | `UNIQUE(code)` |
| `expense_sub_categories`| Subkategori Operasional Lapangan | `UNIQUE(id, categoryId)`, `UNIQUE(categoryId, code)` |
| `field_pics` | Master Koordinator Lapangan (Penerima Uang) | `UNIQUE(name)` |
| `cash_accounts` | Master Akun Kas Tunai & Rekening Bank | `UNIQUE(accountCode)` |
| `submission_batches` | Batch Rekap Mingguan ACC Atasan | `UNIQUE(batchCode)` |
| `acc_expense_items` | Rincian Item ACC yang disetujui Atasan | `UNIQUE(noKas)`, Composite FK ke `project_sub_units(id, projectId)` |
| `fund_inflows` | Penerimaan Drop Dana dari Manajemen | `UNIQUE(inflowNumber)`, `CHECK(amount > 0)` |
| `disbursements` | Event Pencairan Kas Aktual | `UNIQUE(disbursementNumber)`, `CHECK(totalRealizedAmount > 0)` |
| `disbursement_items` | Alokasi Pembayaran Parsial ke Item ACC | FK ke `disbursements`, FK ke `acc_expense_items` |
| `coa_accounts` | Master Bagan Akun Akuntansi (COA) | `UNIQUE(accountCode)` |
| `category_coa_mappings`| Pemetaan Kategori Operasional ke COA | `UNIQUE(categoryId, subCategoryId)` |
| `journal_entries` | Header Jurnal Umum Double-Entry | `UNIQUE(journalNumber)`, `UNIQUE(sourceType, sourceId, status)` (Idempotency) |
| `journal_lines` | Rincian Baris Debet & Kredit Jurnal | `CHECK(debit >= 0)`, `CHECK(credit >= 0)` |

## 3. Critical Integrity Features
1. **No Kas Uniqueness**: `noKas` pada `acc_expense_items` memiliki constraint `@unique` di level database.
2. **Project-Subproject Integrity**: Relasi komposit `(subUnitId, projectId)` menjamin bahwa sub-proyek tidak dapat dipasangkan dengan proyek yang salah.
3. **Atomic Sequence Generator**: Tabel `cash_sequences` menggunakan PostgreSQL `INSERT ... ON CONFLICT DO UPDATE RETURNING` dengan row locking, aman terhadap 100+ concurrent requests.
4. **Journal Idempotency**: Constraint `UNIQUE(sourceType, sourceId, status)` mencegah satu transaksi pencairan atau penerimaan dana menghasilkan jurnal ganda akibat klik ganda atau race condition.
