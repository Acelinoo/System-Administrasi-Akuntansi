# PROTRACK — PHASE 8 REPORT: REAL DATA IMPORT & UAT

---

## 1. Executive Summary

* **Phase:** Phase 8 — Real Data Import & User Acceptance Testing (UAT)
* **Application:** ProTrack — Project Administration & Reporting System
* **Workspace:** `C:\Marchelino Kurniawan\Project-2026\Admsystem`
* **Real-Data Import Engine Status:** **PRODUCTION-READY** (Server-side parser, row-by-row validator, parent-child integrity verifier, atomic transaction isolation, and interactive preview wizard fully implemented and verified).
* **Real Operational Data Status:** **NOT FOUND IN WORKSPACE** (No `.xlsx`, `.xls`, or `.csv` client files were found in `C:\Marchelino Kurniawan\Project-2026\Admsystem` or adjacent workspace folders).
* **Epistemic Discipline Compliance:** In strict compliance with Section 2 of the Phase 8 Directive (*"Do NOT invent financial data. Do NOT generate fake transactions and call them real-data validation... Clearly report that actual Excel-to-ProTrack validation cannot be completed yet"*), fake operational numbers were **NOT fabricated**.
* **Overall Status:** **`REAL-DATA UAT BLOCKED`** (Awaiting real operational Excel file upload from client/user; import engine, validation rules, UI preview, atomic transactions, and downstream consistency are 100% verified and operational).

---

## 2. Source Data

| Attribute | State / Finding |
| :--- | :--- |
| **Source File Name** | *None provided in workspace* (Search performed for `*.xlsx`, `*.xls`, `*.csv`) |
| **Worksheet Count** | N/A (Awaiting real client spreadsheet) |
| **Relevant Date Range** | N/A |
| **Record Count** | 0 real records available in repository |
| **Official Template Available** | **Yes** (`/api/templates/acc-import` — Downloadable via ProTrack UI) |

---

## 3. Excel → ProTrack Mapping

The controlled Excel import engine (`src/lib/finance/import.service.ts`) supports flexible, case-insensitive column headers and maps them to ProTrack data models:

| Excel Field | ProTrack Target | Transformation / Lookup Rule | Validation Rule |
| :--- | :--- | :--- | :--- |
| **No Kas** (`No Kas`, `No. Kas`, `NoKas`, `No ACC`) | `acc_expense_items.no_kas` | Trim, uppercase. If empty, auto-generated from database sequence. | Must match `KU.YY.xxx` or `KT.YY.xxx`. Unique within file and unique in database. |
| **Jenis Kas** (`Jenis Kas`, `Tipe Kas`, `Cash Type`) | `acc_expense_items.cash_type` | Uppercase enum (`KT` or `KU`). Inferred from `noKas` prefix if omitted. | Must be `KU` or `KT`. Must match `noKas` prefix if both provided. |
| **Tanggal** (`Tanggal`, `Tgl`, `Date`, `Tgl ACC`) | `submission_batches.acc_date` | Parsed ISO date / Date object (`YYYY-MM-DD`). | Valid calendar date. |
| **Proyek** (`Proyek`, `Project`, `Kode Proyek`) | `acc_expense_items.project_id` | Case-insensitive lookup against `Project.code` or `Project.name`. | Must exist and be active in master data. Unmapped rows flagged. |
| **Sub Unit** (`Sub Unit`, `Sub-Unit`, `Sub Proyek`) | `acc_expense_items.sub_unit_id` | Lookup against `ProjectSubUnit.code` or `name` under identified project. | **Parent-Child Integrity:** Sub-Unit MUST belong to the specified Project. Unmapped flagged. |
| **Kategori** (`Kategori`, `Category`, `Kategori Biaya`) | `acc_expense_items.category_id` | Lookup against `ExpenseCategory.code` or `name`. | Must exist and be active. Unmapped flagged. |
| **Sub Kategori** (`Sub Kategori`, `SubCategory`) | `acc_expense_items.sub_category_id` | Optional lookup against `ExpenseSubCategory` under identified category. | Must belong to category if provided. |
| **PIC** (`PIC`, `Nama PIC`, `Penanggung Jawab`) | `acc_expense_items.pic_id` | Lookup against `FieldPic.name` (trimmed, case-insensitive). | Must exist and be active in master data. Unmapped flagged. |
| **Uraian** (`Uraian`, `Keterangan`, `Deskripsi`) | `acc_expense_items.description` | Sanitized text string. | Required, minimum 3 characters. |
| **Nominal Diajukan** (`Diajukan`, `Pengajuan`, `Budget`) | `acc_expense_items.requested_amount` | Indonesian currency parsing (removes "Rp", dots, commas). | Optional draft amount; if filled, must be > 0. |
| **Nominal ACC** (`ACC`, `Nominal ACC`, `Disetujui`) | `acc_expense_items.approved_amount` | Indonesian currency parsing to `Decimal(15, 2)`. | **Mandatory:** numeric, must be > 0. Zero/negative rejected. |
| **Catatan** (`Catatan`, `Notes`) | `acc_expense_items.notes` | Sanitized text string. | Optional. |

---

## 4. Import Result

Summary of import engine audit results executed during automated and interactive testing:

| Metric | Value | Notes |
| :--- | :--- | :--- |
| **Total Rows Evaluated in Test Suite** | 10 rows | Across 7 distinct test scenarios in `tests/phase8-import-safety.ts` |
| **Valid Rows Correctly Resolved** | 4 rows | Successfully resolved to active Project, Sub-Unit, Category, and PIC |
| **Rejected Rows (Invalid Data)** | 6 rows | Successfully rejected prior to database insertion: |
| — *Missing Mandatory Headers* | *Blocked* | Header row missing `Proyek`, `Kategori`, or `Nominal ACC` throws immediate error |
| — *Duplicate No Kas (Intra-file)* | 1 row | Caught and flagged in issues table with exact row number |
| — *Duplicate No Kas (Existing in DB)* | 1 row | Pre-flight database check caught collision against active DB records |
| — *Invalid / Zero / Negative Amount* | 3 rows | Checked and flagged (`Nominal ACC harus angka positif lebih besar dari 0`) |
| — *Cross-Project Sub-Unit Mismatch* | 1 row | Caught `ALCENT -> SIPIL` integrity violation (`SIPIL` belongs to `SUMEDANG`) |
| — *Unmapped Master Data* | 3 rows | Detected `PROYEK_FIKTIF_XYZ`, `KATEGORI_TIDAK_ADA`, `PIC_MISTERIUS` |
| **Imported to Database (Audit Batch)** | 2 rows | Atomically inserted into `submission_batches` and `acc_expense_items` |
| **Atomic Transaction Rollback Verification** | **PASS** | Fault injection (1 valid row + 1 duplicate row) rolled back 100% without orphan records |

---

## 5. Reconciliation (Excel vs ProTrack)

> [!NOTE]
> In accordance with Section 2 & 7 of the Phase 8 requirements, this reconciliation reflects the verified test batch imported via the new controlled Excel import engine compared against database state. When the actual client Excel file is uploaded by staff, the UI Preview automatically produces these exact reconciliation totals before confirmation.

| Metric | Source Excel (Batch KT) | ProTrack Database | Difference | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Record Count** | 2 | 2 | 0 | **RECONCILED** |
| **Total ACC (Approved)** | Rp 4.600.000 | Rp 4.600.000 | Rp 0 | **RECONCILED** |
| **Total Realization** | Rp 0 (Fresh Import) | Rp 0 | Rp 0 | **RECONCILED** |
| **Total Outstanding** | Rp 4.600.000 | Rp 4.600.000 | Rp 0 | **RECONCILED** |
| **Project Totals:** | | | | |
| — `ALCENT / SMP` | Rp 2.500.000 | Rp 2.500.000 | Rp 0 | **RECONCILED** |
| — `SUMEDANG / SIPIL` | Rp 2.100.000 | Rp 2.100.000 | Rp 0 | **RECONCILED** |
| **PIC Totals:** | | | | |
| — `PA HERI` | Rp 2.500.000 | Rp 2.500.000 | Rp 0 | **RECONCILED** |
| — `PA DEDI` | Rp 2.100.000 | Rp 2.100.000 | Rp 0 | **RECONCILED** |
| **Category Totals:** | | | | |
| — `UPAH` | Rp 2.500.000 | Rp 2.500.000 | Rp 0 | **RECONCILED** |
| — `MATERIAL` | Rp 2.100.000 | Rp 2.100.000 | Rp 0 | **RECONCILED** |
| **No Kas Uniqueness** | `KT.26.701`, `KT.26.702` | Preserved & Unique | 0 Collision | **RECONCILED** |

---

## 6. UAT Result (System Workflows)

Manual and automated browser testing was conducted against the production build running at `http://localhost:3000`:

| Area | Result | Notes |
| :--- | :--- | :--- |
| **Import Wizard UI (`/acc/import`)** | **PASS** | Dropzone accepts `.xlsx`/`.xls`, displays file size, downloads official template, and presents comprehensive validation summary (Total, Valid, Invalid, Duplicates, Unmapped, Issues Table). |
| **Dashboard (`/`)** | **PASS** | Top cards accurately display live database figures: Total ACC (`Rp 251.170.000`), Realisasi (`Rp 70.585.000`), Outstanding (`Rp 180.585.000`), Inflow (`Rp 280.000.000`), Kas & Bank (`Rp 209.415.000`). Status breakdown reflects active counts. |
| **ACC Management (`/acc`)** | **PASS** | Displays `📥 Impor Excel` button alongside `+ Input ACC Baru`. Filters by Project, Status, Search work seamlessly. |
| **Inflow (`/inflows`)** | **PASS** | Inflow posting correctly records general ledger entries, updates bank balance, and preserves audit trail. |
| **Disbursement (`/disbursements`)** | **PASS** | Partial realization, multiple tranches, overpayment prevention, and insufficient cash validation strictly enforced. |
| **VOID Lifecycle** | **PASS** | Reverses disbursement impact, restores ACC item status to `APPROVED`, resets realized amount, voids journal entries, and excludes voided records from active totals. |
| **PIC Monitoring (`/pic`)** | **PASS** | Displays distribution per PIC, outstanding vouchers, and realization rates with zero discrepancy. |
| **Journal (`/journals`)** | **PASS** | Double-entry invariant strictly balanced: `Total Debit === Total Credit` (`Rp 350.585.000`). VOID journals preserved for audit without affecting active ledger. |
| **Reports (`/reports/*`)** | **PASS** | Rekap ACC, Realisasi, Per Proyek, Per PIC, Kas & Bank, and Jurnal reports reconcile 100% against Dashboard and database records. |
| **Excel Export (ExcelJS)** | **PASS** | All 6 report modules export clean `.xlsx` spreadsheets with proper formatting, headers, and formulas. |
| **PDF Export (jsPDF)** | **PASS** | All 6 report modules generate high-resolution, unclipped PDF documents with filter parameters. |

---

## 7. Bugs Fixed During Phase 8

1. **Next.js Prerender Cold-Start Database Timeout:**
   * *Problem:* Next.js static page optimization during `next build` attempted to prerender dynamic data pages before database connections warmed up on serverless Neon Postgres.
   * *Fix:* Added `export const dynamic = "force-dynamic";` to root `layout.tsx` ensuring dynamic, on-demand server rendering.
2. **Interactive Transaction Timeout:**
   * *Problem:* Remote serverless database latency could occasionally exceed Prisma's default 5000ms transaction timeout.
   * *Fix:* Configured `{ maxWait: 10000, timeout: 25000 }` on all financial transactions (`acc.service.ts`, `inflow.service.ts`, `disbursement.service.ts`, and `import.service.ts`).
3. **ExcelJS NextResponse Body Compatibility:**
   * *Problem:* In Next.js 16 App Router, passing a Node `Buffer` directly to `new NextResponse(buffer)` triggers a TypeScript type incompatibility with `BodyInit`.
   * *Fix:* Wrapped buffer in `new Uint8Array(buffer)` in `src/app/api/templates/acc-import/route.ts`.
4. **Column Mapping Alignment in In-Memory Test Utility:**
   * *Problem:* Heterogeneous test row objects caused column offsets when building synthetic test workbooks.
   * *Fix:* Mapped values explicitly by unique column header set in `tests/phase8-import-safety.ts`.

---

## 8. Known Issues & Operational Classifications

### A. IMPLEMENTATION BUG
* *None.* All automated tests, TypeScript checks, and browser UAT flows passed with zero runtime errors.

### B. DATA QUALITY ISSUE
* **Absence of Real Operational Excel File in Repository:** No real client operational spreadsheet was provided in the project workspace. To uphold epistemic integrity, fake financial numbers were not fabricated.

### C. BUSINESS RULE REQUIRES CONFIRMATION
* **Multiple Sheet Support in Client Workbooks:** If future client Excel workbooks contain multiple worksheets (e.g. one sheet per project or one sheet per week), staff should ensure the active data is in the first sheet or use the official template provided at `/api/templates/acc-import`.
* **Sub-Unit Naming Variations:** If real client spreadsheets use informal abbreviations (e.g., "SMP 1" instead of "SMP"), staff should either add the alias to master data or map it using the provided template before importing.

### D. ENVIRONMENT LIMITATION
* Remote Neon PostgreSQL connection latency requires the configured 10s maxWait / 25s timeout for large atomic transaction batches.

---

## 9. Automated Test Result

Exact commands and outputs executed on the codebase:

### 1. Automated Test Suite (`npm test`)
```powershell
npm test
```
**Result:** **123 / 123 PASSED (100%)**
* `tests/run-all-tests.ts`: **25/25 PASSED** (Services, Sequences, Constraints, Invariants)
* `tests/phase5-consistency-audit.ts`: **19/19 PASSED** (Cross-report consistency, formulas, exports)
* `tests/phase7-e2e-consistency.ts`: **41/41 PASSED** (End-to-end lifecycle, disbursements, VOID reversal, exports)
* `tests/phase8-import-safety.ts`: **38/38 PASSED** (Excel parsing, mandatory columns, duplicate No Kas, invalid amounts, unmapped masters, parent-child integrity, atomic rollback, database reconciliation)

### 2. Linter (`npm run lint`)
```powershell
npm run lint
```
**Result:** **0 errors, 0 warnings** (Clean across `src`).

### 3. TypeScript Compilation (`npx tsc --noEmit`)
```powershell
npx tsc --noEmit
```
**Result:** **0 errors** (Strict type compliance).

### 4. Production Build (`npm run build`)
```powershell
npm run build
```
**Result:** **Compiled successfully** in 25.1s. All 27 server routes, API endpoints, and dynamic pages generated cleanly without errors.

---

## 10. Final Status

```text
REAL-DATA UAT BLOCKED
```

*(Reason: The controlled Excel import architecture, validation engine, preview wizard, atomic transaction safety, and downstream reporting invariants are fully implemented, tested, and production-ready. However, because the actual client operational spreadsheet was not available in the workspace, real-data reconciliation against client data cannot be completed until the file is uploaded by the user).*
