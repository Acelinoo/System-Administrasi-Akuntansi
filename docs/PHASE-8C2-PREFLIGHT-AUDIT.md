# PHASE 8C.2 — PRE-FLIGHT READ-ONLY AUDIT REPORT

**Project**: ProTrack — Project Administration & Reporting System  
**Workspace**: `C:\Marchelino Kurniawan\Project-2026\Admsystem`  
**Execution Date**: October 1, 2026  
**Audit Purpose**: Read-Only Architecture, Schema, and Data Inventory prior to Role Separation, Data Isolation, and Business Confirmation  
**Safety Status**: Zero DB mutations performed; Zero data loss; Read-Only Analysis  

---

## 1. CURRENT SCHEMA ANALYSIS

### Core Schema Models (`prisma/schema.prisma`)
1. **`SubmissionBatch`**:
   - Fields: `id` (UUID), `batchCode` (VarChar 50, unique), `noKas` (VarChar 30, unique, nullable), `accDate` (Date), `approvedByName` (VarChar 100, default "Pa Giri"), `notes` (Text, nullable), `createdById` (UUID, nullable), `createdAt`, `updatedAt`.
   - Relations: `createdBy User?`, `items AccExpenseItem[]`.
   - *Observation*: Currently lacks explicit `administrativeSubmitter` and `dataScope` fields.
2. **`AccExpenseItem`**:
   - Fields: `id` (UUID), `batchId` (UUID), `itemNo` (Int, default 1), `noKas` (VarChar 30), `cashType` (KU/KT), `projectId` (UUID), `subUnitId` (UUID, nullable), `categoryId` (UUID), `subCategoryId` (UUID, nullable), `picId` (UUID), `description` (Text), `requestedAmount` (Decimal 15,2, nullable), `approvedAmount` (Decimal 15,2), `status` (AccStatus: APPROVED, PARTIALLY_REALIZED, FULLY_REALIZED, CANCELLED), `notes` (Text, nullable), `createdAt`, `updatedAt`.
   - Relations: `batch`, `project`, `subUnit`, `category`, `subCategory`, `pic FieldPic`, `disbursementItems DisbursementItem[]`.
   - Unique constraint: `@@unique([batchId, itemNo])`.
   - *Observation*: `picId` references `FieldPic` directly for all items. Fallback mapping caused 724 items to be linked to `NISA`.
3. **`FieldPic`**:
   - Fields: `id` (UUID), `name` (VarChar 100, unique), `roleTitle` (VarChar 100, nullable), `phone` (VarChar 30, nullable), `notes` (Text, nullable), `isActive` (Boolean, default true), `createdAt`, `updatedAt`.
   - Existing records: `PA AGUS`, `PA DEDI`, `PA ENGKUS`, `PA HERI`, `PA MAMAT`, `PA UDEN`, and `NISA`.
   - *Observation*: `NISA` exists in `FieldPic` despite her actual role being administrative submitter rather than field coordinator/mandor. No `UNASSIGNED_MANDOR` record exists yet.
4. **`Project` & `ProjectSubUnit`**:
   - 12 active projects: `SUMEDANG`, `INTERNAL`, `ALCENT`, `KAWALUYAAN`, `RT_BU_ANI`, `TANGGERANG`, `DARUL_ULUM`, `BUDI_INDAH`, `APARTEMEN`, `ANTAPANI`, `CIREBON`, `JL_GITAR`.
   - 6 candidate projects (`DARUL_ULUM`, `BUDI_INDAH`, `APARTEMEN`, `ANTAPANI`, `CIREBON`, `JL_GITAR`) currently have standalone Project rows without explicit business confirmation flags.
5. **`CashAccount`**:
   - Accounts: `KAS_NISA` (CASH), `MANDIRI_CBS` (BANK), `BJB_CBS` (BANK), etc.
6. **`Disbursement` & `DisbursementItem`**:
   - 37 disbursements currently in database (20 POSTED, 17 VOID / legacy test runs).
   - All existing disbursements originate from test batches (`BATCH-TEST-...`, `BATCH-P7-...`, `BATCH-P8B-...`).
7. **`FundInflow`**:
   - 21 inflows currently in database (all POSTED, totaling Rp 360.000.000). All originate from test scenarios.
8. **`JournalEntry` & `JournalLine`**:
   - 62 journal entries (45 POSTED, 17 VOID). All originate from test disbursements (41) and inflows (21). Zero journals originate from raw ACC imports.

---

## 2. CURRENT PIC MODEL & DISTRIBUTION

Database query on `field_pics` and `acc_expense_items`:

| PIC Name | Database UUID | Item Count | Total Approved Amount | Field Role Evidence |
| :--- | :--- | ---: | ---: | :--- |
| **NISA** | `b30c04be-3ee3-4601-b0cb-86e6f60b778e` | **724 items** | **Rp 2.850.637.788** | 1 item explicitly mentions Nisa (*"Pembelian Pembersih Kaca SMP Nisa"*); 723 items are fallback mapping without field PIC evidence |
| **PA AGUS** | `14f624dc-b691-40a0-a1ef-c0ff46e10128` | 39 items | Rp 1.167.670.000 | Explicit *"Pa Agus"* on description |
| **PA HERI** | `60b24716-eeb2-4250-b10f-d4ae996cda78` | 117 items | Rp 386.809.628 | Explicit *"Pa Heri"* / *"Heri"* on description |
| **PA MAMAT**| `81b238b6-2899-4afa-8d55-afa3fdd5bc38` | 97 items | Rp 146.394.500 | Explicit *"Pa Mamat"* / *"Mamat"* on description |
| **PA DEDI** | `0746f3da-058c-4637-af69-c3264b4e6438` | 98 items | Rp 39.188.750 | Explicit *"Pa Dedi"* / *"Dedi"* on description |
| **PA UDEN** | `d018b135-38a5-4c31-8d5f-105c02b09442` | 3 items | Rp 113.000 | Explicit *"Pa Uden"* on description |
| **PA ENGKUS**| `626fe2b2-c884-436e-b9cb-91950f2aafb6`| 0 items | Rp 0 | Backup PIC |
| **UNASSIGNED_MANDOR** | *(Not yet present)* | 0 items | Rp 0 | Required state for items without PIC evidence |

### Core Architectural Flaw
The current system assigns `NISA` as the `picId` for 723 items where no field mandor was mentioned. Consequently, reports grouped by PIC show Nisa as responsible for Rp 2.850.637.788 of field expenses, distorting field accountability.

---

## 3. CURRENT TEST DATA RECORDS (BASELINE AUDIT)

A detailed inspection of all 404 batches in the database confirms:

| Batch Group | Prefix / Pattern | Batches | ACC Items | Total Approved Amount | Classification |
| :--- | :--- | ---: | ---: | ---: | :--- |
| **Phase 7 E2E Batches** | `BATCH-P7-*` | 4 | 4 | Rp 181.170.000 | **TEST DATA** |
| **Phase 5 & 8 Safety Test Batches** | `BATCH-TEST-*` | 17 | 34 | Rp 119.000.000 | **TEST DATA** |
| **Phase 8B Verification Batches** | `BATCH-P8B-*` | 4 | 12 | Rp 8.591.248 | **TEST DATA** |
| *Subtotal Pure Test Batches* | | **25** | **50** | **Rp 308.761.248** | **TEST DATA** |
| *(Baseline from Phase 8C.1)* | *(22 batches)* | *(22)* | *(44)* | *(Rp 287.761.248)* | *(Pure Test Baseline)* |
| **Real Excel KU Batches** | `BATCH-KU-*` | 34 | 78 | Rp 93.418.990 | **REAL DATA** |
| **Real Excel KT Batches** | `BATCH-KT-*` | 343 | 946 | Rp 4.183.733.428 | **REAL DATA** |
| **Real Excel KN Batches** | `BATCH-KN-*` | 2 | 4 | Rp 25.900.000 | **REAL DATA** |
| *Subtotal Real Excel Imported* | | **379** | **1.028** | **Rp 4.303.052.418** | **REAL DATA** |
| **TOTAL DATABASE** | | **404** | **1.078** | **Rp 4.611.813.666** | |

*Note on Pre-Existing Collision*: 15 vouchers (20 items, Rp 16.087.000) from Excel were imported into DB during Phase 8B verification batches before Phase 8C. Adding Rp 16.087.000 + Rp 4.303.052.418 = Rp 4.319.139.418 (100% of Excel candidate).

---

## 4. CURRENT DASHBOARD & REPORTING AGGREGATIONS

Inspection of `src/app/actions/acc.actions.ts` (`getDashboardStats`), `src/lib/finance/balance.service.ts` (`getCashAccountBalance`), and `src/lib/reports/*.ts`:

1. **Dashboard (`src/app/actions/acc.actions.ts`)**:
   - Queries `prisma.submissionBatch.count()`, `prisma.accExpenseItem.count()`, and `prisma.accExpenseItem.aggregate({ _sum: { approvedAmount: true } })` **without filtering on test data**.
   - Queries `prisma.fundInflow.aggregate` and `prisma.disbursement.aggregate` **without data scope filtering**.
   - Result: Contaminates the main dashboard metrics with test data.
2. **Balance Service (`src/lib/finance/balance.service.ts`)**:
   - Sums all `POSTED` inflows and `POSTED` disbursements directly from `fund_inflows` and `disbursements`.
   - Result: Active liquidity of Rp 275.215.000 or Rp 241.215.000 is 100% comprised of test transactions. Operational real data currently has 0 posted inflows and 0 posted disbursements.
3. **Reports (`src/lib/reports/acc-report.service.ts`, `pic-report.service.ts`, `project-report.service.ts`, etc.)**:
   - None of the report services filter by `dataScope`. All test batches and items are rendered alongside real transactions.
4. **Exports (`src/lib/export/excel-export.service.ts`, `pdf-export.service.ts`)**:
   - Export payloads are generated directly from the report services, inheriting test data contamination.

---

## 5. CANDIDATE PROJECTS STATUS

Inspection of `projects` table for the 6 candidate projects:

| Project Code | Project Name | Items | Total Approved | Sub-Unit | Notes / Parent Candidate |
| :--- | :--- | ---: | ---: | :--- | :--- |
| **DARUL_ULUM** | Proyek Darul Ulum | 11 | Rp 6.080.000 | None | Small project; candidate sub-project or standalone |
| **BUDI_INDAH** | Proyek Budi Indah | 4 | Rp 530.000 | None | Small renovation; candidate sub-project |
| **APARTEMEN** | Proyek Apartemen | 6 | Rp 1.372.500 | None | Interior fit-out; candidate sub-project |
| **ANTAPANI** | Proyek Antapani | 5 | Rp 1.059.000 | None | Small renovation; candidate sub-project |
| **CIREBON** | Proyek Cirebon | 2 | Rp 150.000 | None | Minor travel / survey expense |
| **JL_GITAR** | Proyek Jl. Gitar | 5 | Rp 1.008.500 | None | Small residential work |

All 6 are currently marked active and stand as independent projects without explicit business confirmation indicators.

---

## 6. HELD REALIZATION Rp 34.299.517

From the real Excel workbook, candidate realization vouchers total **Rp 34.299.517**.
- Bulk Importer Phase 8C correctly **did NOT** create active disbursement vouchers for this amount.
- Reason: Source bank account (e.g. Kas Nisa, Mandiri CBS, BJB CBS) and exact debit dates were not confirmed by management.
- Current Status: Held in `PENDING_CONFIRMATION`. No active posted disbursement, no cash deduction, no journal generated.

---

## 7. IMPACTED CODE & COMPONENTS

The following areas will be modified or scoped in Phase 8C.2:
1. **Database Schema (`prisma/schema.prisma`)**:
   - Add `dataScope` (`DataScope` enum: `REAL`, `TEST`) to `SubmissionBatch`, `AccExpenseItem`, `Disbursement`, `FundInflow`, `JournalEntry`.
   - Add `administrativeSubmitter` to `SubmissionBatch` (default "NISA").
   - Add `assignmentStatus` (`PicAssignmentStatus` enum: `ASSIGNED`, `UNASSIGNED_MANDOR`) to `AccExpenseItem`.
   - Add `confirmationStatus` to `Project` (e.g. `CONFIRMED`, `REQUIRES_BUSINESS_CONFIRMATION`).
   - Add master `FieldPic` entry for `UNASSIGNED_MANDOR`.
2. **Finance Services**:
   - `src/lib/finance/balance.service.ts`: Support `dataScope: REAL` filtering.
   - `src/lib/finance/acc.service.ts`: Support `administrativeSubmitter`, `assignmentStatus`, and `dataScope`.
   - `src/lib/finance/disbursement.service.ts` & `inflow.service.ts`: Support `dataScope`.
3. **Report Services**:
   - `src/lib/reports/acc-report.service.ts`
   - `src/lib/reports/pic-report.service.ts`
   - `src/lib/reports/project-report.service.ts`
   - `src/lib/reports/cash-report.service.ts`
   - `src/lib/reports/journal-report.service.ts`
   - `src/lib/reports/realization-report.service.ts`
   Default all queries to `dataScope: REAL` (with optional scope toggle).
4. **App Actions & Pages**:
   - `src/app/actions/acc.actions.ts`: Scope dashboard queries to `REAL`.
   - `src/app/actions/pic.actions.ts`: Filter out submitters, use field PICs, include `UNASSIGNED_MANDOR`.
   - `src/app/page.tsx`: Display clean `REAL` data scope metrics.
   - `src/app/pic/page.tsx`: Present role separation clearly.
   - `src/app/master/projects/page.tsx`: Display confirmation status tag for candidate projects.
5. **Testing**:
   - `tests/phase8c2-business-confirmation.ts`: 15 required automated test assertions.
   - Existing 7 test suites must continue passing without regression.

---

## 8. PRE-FLIGHT CONCLUSION & NEXT STEPS
The audit is complete. The system state is fully documented.
We proceed immediately to Workstream A (Role Separation), Workstream B (Data Isolation), Workstream C (Realization Hold), and Workstream D (Project Confirmation).
