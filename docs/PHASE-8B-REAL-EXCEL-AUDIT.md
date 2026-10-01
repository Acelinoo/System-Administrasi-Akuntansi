# PHASE 8B — REAL EXCEL MAPPING & IMPORT CORRECTION AUDIT REPORT

**Project**: ProTrack — Project Administration & Reporting System  
**Workspace**: `C:\Marchelino Kurniawan\Project-2026\Admsystem`  
**Date**: October 1, 2026  
**Auditor**: Lead System Architect & Financial Safety Auditor  
**Status**: `REAL EXCEL MAPPING READY`  
**Action**: **HARD STOP** (No direct production database bulk import without verified client confirmation)

---

## 1. WORKBOOK EXECUTIVE SUMMARY

| Attribute | Specification | Notes |
| :--- | :--- | :--- |
| **Filename** | `Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx` | Operational weekly recap source workbook |
| **File Size** | 637,945 bytes | 80 worksheets total |
| **Sheet Count** | **80 worksheets** | Spanning January – September 2026 |
| **Recap Sheets (Type A)** | **44 sheets** | e.g. `Tgl 9`, `Tgl 10`, `Sheet8`, `Sheet11`, `2 JULI`, `10 JULI`, `18 JULI`, `25 JULI` |
| **Detail Sheets (Type B)** | **36 sheets** | e.g. `Sheet2`, `Sheet5`, `Sheet43`, `Sheet44`, `Sheet55` (Mandor breakdown: `PA HERI`, `Pa Dedi`, `PA MAMAT`, `NISA`) |
| **Date Range** | January 9, 2026 – September 2026 | 9 months of real operational project finance data |
| **Total Rows Analyzed** | **994 line items** across Type A recap sheets | Real operational financial records |
| **Unique No Kas Identifiers** | **410 unique vouchers** | Identifiers such as `Ku.26.028`, `Kt.26.176`, `Kn.26.006` |
| **Multi-Item Vouchers** | **228 vouchers (55.6%)** | **Critical confirmation**: More than half of all vouchers contain > 1 line item |
| **Repeated Weekly Snapshots** | **106 vouchers** | Outstanding/carried-forward vouchers recurring across consecutive weekly sheets |

---

## 2. DATA MODEL FINDINGS & ARCHITECTURAL CORRECTIONS

### 2.1 The No Kas Relationship: 1 Voucher (Batch) to N Items
- **Original Incompatible Assumption**: `acc_expense_items.no_kas UNIQUE`. In the original synthetic schema, each expense row had its own unique `no_kas`.
- **Real Operational Finding**: In real daily operations, a `No Kas` (e.g. `Ku.26.028`) represents a **Disbursement Voucher / Submission Batch Header**, containing multiple individual line items (e.g., BPJS Kesehatan `1,194,312`, BPJS TK `450,000`, BPJS Pa Bey `200,000`, Telp & Internet `503,500`, Listrik `503,500`).
- **Architectural Solution**:
  1. `submission_batches.noKas` is added as an optional unique header identifier (`String? @unique @db.VarChar(30)`).
  2. `acc_expense_items.noKas` is kept as a denormalized line-item reference (`@db.VarChar(30)`), but the `@unique` constraint is **removed**.
  3. Added composite unique constraint `@@unique([batchId, itemNo])` with sequential line-item numbering (`itemNo Int @default(1)`).
  4. Services (`acc.service.ts` and `import.service.ts`) redesigned to group line items sharing the same `No Kas` into a single atomic `SubmissionBatch`.

### 2.2 Pengajuan vs. Pencairan Separation
- **Real Operational Finding**: The recap worksheets feature separate columns for **PENGAJUAN** (requested / approved by management) and **PENCAIRAN** (`SUDAH`, `CASH`, `GIRO`, `TRANSFER`).
- **Invariance Rule**: `PENGAJUAN ≠ PENCAIRAN`.
  - When `PENCAIRAN` is empty, the item is an approved ACC with `Realization = 0` (outstanding liability).
  - When `PENCAIRAN` has a value, it denotes actual paid disbursement.
  - No automated `POSTED` disbursement or cash journal is created unless actual realization is recorded.

### 2.3 Multiple Date Snapshots Per Sheet
- **Real Operational Finding**: Worksheets such as `2 JULI` do not contain a single flat table. Instead, they contain multiple sequential date blocks:
  - `PER TANGGAL 2 JULI 2026`
  - `PER TANGGAL 2 JULI 2026 (YANG ACC PA GIRI)`
  - `PER TANGGAL 4 JULI 2026`
  - `PER TANGGAL 6 JULI 2026`
- **Rule**: Sheet names (e.g. `2 JULI`) must **never** be used as the transaction date. Dates must be parsed from header block markers (`PER TANGGAL DD MMMM YYYY`).

### 2.4 Recap Sheets vs. Detail / Mandor Sheets
- **Relationship**:
  - **Type A (Recap Sheets)**: Official financial recaps approved by management (`ACC PA GIRI`) with assigned `No Kas`, official amounts, and payment channel indicators.
  - **Type B (Detail Sheets)**: Operational breakdown sheets per site supervisor / mandor (`PA HERI`, `Pa Dedi`, `PA MAMAT`, `NISA`, `Pa Uden`). These represent pre-recap breakdowns submitted by field supervisors.
- **Rule Against Double Counting**: Detail sheets must **NOT** be imported as independent transactions. The **Source of Truth** for ProTrack financial balances is Type A (Recap Sheets). Type B sheets serve as audit references.

### 2.5 De-duplication of Weekly Carried-Forward Snapshots
- **Real Operational Finding**: 106 vouchers recur across consecutive weekly recap sheets because un-disbursed or partially-disbursed items are carried forward from week to week.
- **Rule**: The importer tracks existing `noKas` vouchers across sheets. If an identical `No Kas` voucher already exists, subsequent sheet occurrences are recognized as snapshot status updates rather than new transactions, preventing double-counting of liabilities.

---

## 3. EXCEL FIELD → PROTRACK FIELD MAPPING

| Excel Source Column / Marker | ProTrack Target Field | Transformation & Normalization | Validation Rule | Status |
| :--- | :--- | :--- | :--- | :--- |
| `NO KAS` / `NO.` (e.g. `Ku.26.028`, `Kt.26.176`) | `submission_batches.noKas` & `acc_expense_items.noKas` | Trim whitespace, standard upper/lower case normalization (`Ku.26.028` -> `KU.26.028`). | Standard format: `K[u/t/n].YY.NNN` or custom legacy code. Row-level error if malformed. | **MAPPED & VERIFIED** |
| `KETERANGAN PENGAJUAN` / `URAIAN` | `acc_expense_items.description` | Trim whitespace, clean extra line breaks. Extract contextual sub-units if embedded. | Non-empty string, max 255 chars. | **MAPPED & VERIFIED** |
| `PENGAJUAN` (Amount) | `acc_expense_items.requestedAmount` & `approvedAmount` | Numeric clean (remove commas, dots, currency symbols). | Amount > 0. Decimal(15,2). | **MAPPED & VERIFIED** |
| `PENCAIRAN` / `REALISASI` | `disbursements.amount` | Numeric clean. If empty or 0, item marked outstanding (`isRealized = false`). | Amount >= 0, Amount <= Approved Amount. | **MAPPED & VERIFIED** |
| Header `PER TANGGAL [Date]` | `submission_batches.batchDate` & `acc_expense_items.expenseDate` | Indonesian date parser: e.g. `2 JULI 2026` -> `2026-07-02T00:00:00Z`. | Valid ISO date within fiscal year 2026. | **MAPPED & VERIFIED** |
| `CASH` / `GIRO` / `TRANSFER` | `disbursements.paymentMethod` & `cash_transactions.channel` | Identify checkmark (`v`, `x`, value) in payment column. | Enum: `CASH`, `BANK_TRANSFER`, `GIRO`. Default to `CASH` if marked in cash column. | **MAPPED & VERIFIED** |
| Project indicator in Description / Header | `acc_expense_items.projectId` | Map keywords (`Sumedang`, `SMA`, `UPI`, `Antapani`) to Project Master. | Target project must exist. Flag unmapped projects for review. | **REVIEW REQUIRED** (Candidate Master) |
| PIC column / header / signature (`PA HERI`, `NISA`) | `acc_expense_items.picId` or `picName` | Normalize names (`PA MAMAT` -> `Pa Mamat`). Match to User/PIC registry. | Target PIC must exist. Fallback to unassigned with audit note. | **REVIEW REQUIRED** (Candidate Master) |

---

## 4. CRITICAL SCHEMA CHANGES IMPLEMENTED

Prisma schema `prisma/schema.prisma` was successfully updated and migrated via `prisma db push`:

```prisma
model SubmissionBatch {
  id              String           @id @default(uuid()) @db.VarChar(36)
  batchNumber     String           @unique @map("batch_number") @db.VarChar(50)
  noKas           String?          @unique @map("no_kas") @db.VarChar(30)
  batchDate       DateTime         @map("batch_date")
  cashType        CashType         @default(PROJECT_EXPENSE) @map("cash_type")
  description     String?          @db.VarChar(255)
  totalItems      Int              @default(0) @map("total_items")
  totalAmount     Decimal          @default(0) @map("total_amount") @db.Decimal(15, 2)
  ...
  expenseItems    AccExpenseItem[]
  ...
  @@map("submission_batches")
}

model AccExpenseItem {
  id              String          @id @default(uuid()) @db.VarChar(36)
  batchId         String          @map("batch_id") @db.VarChar(36)
  itemNo          Int             @default(1) @map("item_no")
  noKas           String          @map("no_kas") @db.VarChar(30)
  expenseDate     DateTime        @map("expense_date")
  projectId       String          @map("project_id") @db.VarChar(36)
  categoryId      String          @map("category_id") @db.VarChar(36)
  description     String          @db.VarChar(255)
  ...
  @@unique([batchId, itemNo])
  @@index([noKas])
  @@map("acc_expense_items")
}
```

---

## 5. AUDIT & TEST SUITE VERIFICATION

All 7 required Phase 8B test scenarios in `tests/phase8b-real-excel-audit.ts` have been executed and passed:

| Test Case | Scenario Description | Expected Outcome | Actual Result |
| :--- | :--- | :--- | :--- |
| **Test 1** | Multiple expense items sharing one No Kas (e.g. `KU.26.028` with 5 items) | 1 ACC Batch created with 5 sequential ACC Items (`itemNo` 1..5) | **PASS** |
| **Test 2** | One ACC item with no realization (`PENCAIRAN` is empty) | ACC batch and item created; Realized = 0; Outstanding = 100% | **PASS** |
| **Test 3** | Partial realization (`PENCAIRAN` < `PENGAJUAN`) | Realized = 500k, Approved = 1.5M, Outstanding = 1M | **PASS** |
| **Test 4** | Multiple date blocks in one sheet (`PER TANGGAL ...`) | Each date block parsed as distinct batch with accurate date | **PASS** |
| **Test 5** | Recap sheet vs. Detail / Mandor sheet architecture | Recap treated as source of truth; Detail sheets not double-counted | **PASS** |
| **Test 6** | Repeated weekly snapshot de-duplication | Outstanding items carried forward are reconciled without double-counting | **PASS** |
| **Test 7** | Malformed No Kas row validation | Rejected at row-level with explicit error; does not corrupt entire import | **PASS** |

### Automated Quality Gate Results
- **Automated Tests**: **150 / 150 PASSED (100%)** across 5 test suites:
  - `run-all-tests.ts`: 40/40 passed
  - `phase5-consistency-audit.ts`: 21/21 passed
  - `phase7-e2e-consistency.ts`: 29/29 passed
  - `phase8-import-safety.ts`: 53/53 passed
  - `phase8b-real-excel-audit.ts`: 7/7 passed
- **Linter (`npm run lint`)**: **0 errors, 0 warnings**
- **TypeScript Check (`npx tsc --noEmit`)**: **0 errors**

---

## 6. CANDIDATE MASTER VALUES REQUIRING BUSINESS CONFIRMATION

The real workbook contains recurring names that must be confirmed by project management before final master entity assignment:

### 6.1 Candidate Projects & Sub-Units
- `SUMEDANG` (SMA, SMP, SD, TK)
- `DARUL ULUM`
- `BUDI INDAH`
- `APARTEMEN`
- `KAWALUYAAN`
- `TANGERANG`
- `ANTAPANI`
- `UPI`
- `RT BU ANI`
- `CIREBON`
- `JL. GITAR`

*Recommendation*: Create these as new Project Master records or Sub-Unit tags linked to existing parent projects.

### 6.2 Candidate Field Supervisors (PIC)
- `PA HERI` (Heri)
- `PA DEDI` (Dedi)
- `PA MAMAT` (Mamat)
- `NISA` (Nisa)
- `PA UDEN` (Uden)
- `PA ENGKUS` (Engkus)

*Recommendation*: Add these 6 site coordinators to the PIC / Staff master table with standardized title casing.

### 6.3 Realization Channels
- `CASH`: Disbursed from Petty Cash / Project Cash account.
- `TRANSFER` / `GIRO`: Disbursed from Main Operational Bank account.

---

## 7. FINAL STATUS & NEXT STEPS

```text
================================================================================
FINAL STATUS: REAL EXCEL MAPPING READY
================================================================================
```

### HARD STOP ENFORCED
The audit, schema redesign, service adaptation, and validation tests are complete. In strict adherence to Section 21 of Phase 8B instructions:
- **No live bulk import of the 80 sheets has been executed yet.**
- Awaiting user/management approval of the Candidate Master Data (Projects, PICs) and realization journal mapping before executing the final production migration.
