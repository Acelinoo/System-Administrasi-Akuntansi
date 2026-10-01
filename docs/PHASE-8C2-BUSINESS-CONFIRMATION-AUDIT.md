# PHASE 8C.2 — BUSINESS CONFIRMATION, ROLE SEPARATION & TEST DATA ISOLATION AUDIT REPORT

**Project**: ProTrack — Project Administration & Reporting System  
**Workspace**: `C:\Marchelino Kurniawan\Project-2026\Admsystem`  
**Execution Date**: October 1, 2026  
**Status**: **`PHASE 8C.2 — PASSED WITH REMAINING BUSINESS CONFIRMATIONS`**  

---

## 1. EXECUTIVE SUMMARY

Phase 8C.2 successfully resolves the four architectural issues identified in Phase 8C.1:
1. **Administrative Submitter vs Field PIC Separation**:
   - `NISA` is explicitly classified as `ADMINISTRATIVE_SUBMITTER` for all 379 imported real batches.
   - All 723 fallback items (Rp 2.850.378.038) previously attributed to Nisa without field evidence are reassigned to `UNASSIGNED_MANDOR` (`MANDOR_BELUM_DITENTUKAN`).
   - Only 1 item (`KT.26.532`, Rp 259.750) explicitly mentioning *"Pembelian Pembersih Kaca SMP Nisa"* remains under Nisa as field PIC.
   - Explicit field mandors (`PA HERI`, `PA DEDI`, `PA MAMAT`, `PA AGUS`, `PA UDEN`) with 304 items (Rp 1.452.414.630) remain intact.
2. **Real Data vs Test Data Isolation**:
   - Added `dataScope` (`REAL` vs `TEST`) across `SubmissionBatch`, `AccExpenseItem`, `FundInflow`, `Disbursement`, and `JournalEntry`.
   - All 25 test batches (Rp 271.674.248) and test transactions are strictly isolated in `TEST` scope. Zero test records deleted or truncated.
   - All operational modules (Dashboard, ACC, Cash Balances, PIC, Projects, Reports, Excel/PDF Exports) default to `dataScope: REAL`.
3. **Excel Realization Rp 34.299.517 Hold**:
   - The 4 candidate realization items totaling exactly **Rp 34.299.517** were forensically traced in the source Excel workbook and placed in **`PENDING_CONFIRMATION`**.
   - Zero active posted disbursements or cash movements were created. Operational cash balance remains 100% untampered.
4. **Candidate Projects Classification**:
   - 6 candidate projects (`DARUL_ULUM`, `BUDI_INDAH`, `APARTEMEN`, `ANTAPANI`, `CIREBON`, `JL_GITAR`) comprising 33 items (Rp 10.200.000) are flagged with `confirmationStatus: REQUIRES_BUSINESS_CONFIRMATION` and `possibleParentCode: "INTERNAL"`.

---

## A. ADMINISTRATIVE SUBMITTER VS FIELD PIC

| Category / Role | Master Entity / Name | Role Title | Item Count | Approved Amount | Evidence & Assignment Rule |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Administrative Submitter** | `NISA` (on Batches) | `ADMINISTRATIVE_SUBMITTER` | **1,028 items (379 batches)** | **Rp 4.303.052.418** | Submitter of weekly Excel recap sheets to management (`Pa Giri`). |
| **Field PIC (Explicit)** | `NISA` | `ADMINISTRATIVE_SUBMITTER` | **1 item** | **Rp 259.750** | `KT.26.532`: *"Pembelian Pembersih Kaca SMP Nisa"*. Explicit note. |
| **Field PIC (Explicit)** | `PA HERI` | `KOORDINATOR_LAPANGAN` | **117 items** | **Rp 518.232.000** | Explicit name in `KETERANGAN PENGAJUAN` and sheet header. |
| **Field PIC (Explicit)** | `PA MAMAT` | `MANDOR_FINISHING` | **97 items** | **Rp 520.478.000** | Explicit name in `KETERANGAN PENGAJUAN`. |
| **Field PIC (Explicit)** | `PA DEDI` | `LOGISTIK_LAPANGAN` | **48 items** | **Rp 254.689.630** | Explicit name in `KETERANGAN PENGAJUAN`. |
| **Field PIC (Explicit)** | `PA AGUS` | `MANDOR_BORONGAN_SIPIL` | **39 items** | **Rp 147.215.000** | Explicit name in `KETERANGAN PENGAJUAN`. |
| **Field PIC (Explicit)** | `PA UDEN` | `KOORDINATOR_LAPANGAN` | **3 items** | **Rp 11.800.000** | Explicit name in `KETERANGAN PENGAJUAN`. |
| **Field PIC (Unassigned)** | `UNASSIGNED_MANDOR` | `MANDOR_BELUM_DITENTUKAN` | **723 items** | **Rp 2.850.378.038** | Reassigned from fallback Nisa. No field PIC evidence in source. |
| **TOTAL REAL DATA** | - | - | **1,028 items** | **Rp 4.303.052.418** | **100% Balanced & Verified** |

---

## B. TEST DATA ISOLATION

| Metric | TEST Scope | REAL Scope | ALL (Total DB) | Isolation Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| **Submission Batches** | 25 batches | **379 batches** | 404 batches | `dataScope: REAL` filter applied on all operational queries |
| **ACC Expense Items** | 50 items | **1,028 items** | 1,078 items | `dataScope: REAL` on items and batches |
| **Approved Amount** | Rp 271.674.248 | **Rp 4.303.052.418** | Rp 4.574.726.666 | Operational reports strictly sum `dataScope: REAL` |
| **Fund Inflows** | 21 inflows | **0 inflows** | 21 inflows | Operational inflows sum strictly `dataScope: REAL` |
| **Disbursements** | 37 disbursements | **0 disbursements** | 37 disbursements | Operational disbursements sum strictly `dataScope: REAL` |
| **Cash Account Liquidity** | Rp 275.215.000 | **Rp 0** | Rp 275.215.000 | Zero operational cash contaminated by test funds |
| **Active Journals** | 55 entries | **0 entries** | 55 entries | Operational journal report contains 0 test rows |

### How Scope Is Enforced
1. **Database Enums & Defaults**: Added `enum DataScope { REAL, TEST }` with default `REAL`.
2. **Central Balance Calculation (`balance.service.ts`)**: `getAllCashBalances` defaults strictly to `DataScope.REAL`. Operational cash balance is untouched by test inflows/disbursements.
3. **App Actions & Server Queries**: `acc.actions.ts`, `pic.actions.ts`, `disbursement.actions.ts`, `inflow.actions.ts`, `journal.actions.ts` filter by `dataScope: REAL` by default.
4. **All 6 Report Services**: `acc-report`, `pic-report`, `project-report`, `realization-report`, `cash-report`, `journal-report` enforce `dataScope: REAL` by default.
5. **Excel & PDF Exports**: Export endpoints pass `dataScope: REAL`.
6. **Zero Data Loss**: Test batches from Phase 5, Phase 7, Phase 8, and Phase 8B are preserved with `dataScope: TEST`. No `DELETE` or `TRUNCATE` operations were executed.

---

## C. REALIZATION PENDING (Rp 34.299.517)

Forensic trace of candidate realizations found in source Excel workbook:

| No Kas | Uraian Transaksi | Nominal (Rp) | Cash Channel | Source Sheet | Source Row | Source Block | Status |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| `KT.26.180` | Upah Tukang RT Bu Ani Minggu Lalu | 1.356.000 | `KAS_NISA` | Pengajuan RT bu Ani ke 3 | 14 | 1 | `PENDING_CONFIRMATION` |
| `KT.26.180` | Upah Tukang RT Bu Ani Minggu ini | 3.162.000 | `KAS_NISA` | Pengajuan RT bu Ani ke 3 | 15 | 1 | `PENDING_CONFIRMATION` |
| `KT.26.214` | Sisa Pemb Matrial Pro Sumedang | 22.512.000 | `MANDIRI_CBS` | Sheet24 | 23 | 2 | `PENDING_CONFIRMATION` |
| `KT.26.652` | Talangan Nisa Pembelian Sanitair | 7.269.517 | `UNKNOWN` | 28 AGUSTUS | 58 | 1 | `PENDING_CONFIRMATION` |
| **TOTAL** | - | **34.299.517** | - | - | - | - | **HELD IN PENDING_CONFIRMATION** |

### Channel Breakdown
- **`KAS_NISA`**: Rp 4.518.000 (2 items from `KT.26.180` with Cash column marked).
- **`MANDIRI_CBS`**: Rp 22.512.000 (1 item from `KT.26.214` with Transfer column marked).
- **`BJB_CBS`**: Rp 0.
- **`UNKNOWN`**: Rp 7.269.517 (1 item from `KT.26.652` noted as reimbursement talangan without source bank account).

**Operational Action Taken**: Zero active disbursements, zero posted journals, and zero cash movements were created. All 4 items remain held in `PENDING_CONFIRMATION`.

---

## D. CANDIDATE PROJECTS (BUSINESS CONFIRMATION)

| Project Code | Project Name | Items | Amount (Rp) | Current Confirmation Status | Source Evidence | Possible Parent |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `DARUL_ULUM` | Proyek Darul Ulum | 11 | 6.080.000 | `REQUIRES_BUSINESS_CONFIRMATION` | Sheet Darul Ulum | `INTERNAL` |
| `BUDI_INDAH` | Proyek Budi Indah | 4 | 530.000 | `REQUIRES_BUSINESS_CONFIRMATION` | Uraian Budi Indah / BD Indah | `INTERNAL` |
| `APARTEMEN` | Proyek Apartemen | 6 | 1.372.500 | `REQUIRES_BUSINESS_CONFIRMATION` | Uraian Apartemen | `INTERNAL` |
| `ANTAPANI` | Proyek Antapani | 5 | 1.059.000 | `REQUIRES_BUSINESS_CONFIRMATION` | Uraian Antapani | `INTERNAL` |
| `CIREBON` | Proyek Cirebon | 2 | 150.000 | `REQUIRES_BUSINESS_CONFIRMATION` | Uraian Cirebon | `INTERNAL` |
| `JL_GITAR` | Proyek Jl. Gitar | 5 | 1.008.500 | `REQUIRES_BUSINESS_CONFIRMATION` | Uraian Jl. Gitar | `INTERNAL` |
| **TOTAL** | - | **33** | **10.200.000** | - | - | - |

---

## E. DATA INTEGRITY AUDIT

| Verification Check | Target Standard | Measured Result | Audit Status |
| :--- | :---: | :---: | :---: |
| Existing financial amount changed | 0 | **0** | **PASS** |
| Deleted financial records | 0 | **0** | **PASS** |
| No Kas changed | 0 | **0** | **PASS** |
| Duplicate batch headers | 0 | **0** | **PASS** |
| Orphan ACC items | 0 | **0** | **PASS** |
| Orphan disbursements | 0 | **0** | **PASS** |
| Orphan journal entries | 0 | **0** | **PASS** |
| Real vouchers uniqueness | 379 unique vouchers | **379 unique** | **PASS** |
| Source provenance preservation | 1,028 items | **1,028 items** | **PASS** |
| Active journal double-entry balance | Debit === Credit | **100% Balanced** | **PASS** |
| Cash balances >= 0 | Non-negative | **>= 0 for all accounts** | **PASS** |

---

## F. AUTOMATED TEST SUITE & QUALITY GATES

All mandatory quality gates passed with zero errors:

| Quality Gate | Command | Execution Time | Results | Status |
| :--- | :--- | :---: | :--- | :---: |
| **Automated Tests** | `npm test` | ~45s | **8 Test Suites (1,442 tests in Phase 8C.2 suite alone), 0 failures** | **PASS** |
| **Linter** | `npm run lint` | ~5s | **0 errors, 0 warnings** (Clean ESLint) | **PASS** |
| **Type Check** | `npx tsc --noEmit` | ~24s | **0 TypeScript errors** | **PASS** |
| **Production Build** | `npm run build` | ~25s | **Turbopack compiled successfully, 26 routes generated** | **PASS** |

---

## G. BROWSER UAT VERIFICATION

Browser UAT was executed via autonomous subagent on `http://localhost:3000`:
- **Dashboard**: Verified `REAL DATA ONLY` badge, Total Pengajuan `Rp 4.303.052.418` (379 batch, 1028 item), Realisasi `Rp 0`. (Screenshot: `uat_dashboard_1790842640606.png`).
- **PIC Page**: Verified `UNASSIGNED_MANDOR` card (`MANDOR_BELUM_DITENTUKAN`, 723 items, Rp 2.850.378.038), `NISA` card (`ADMINISTRATIVE_SUBMITTER`, 1 item, Rp 259.750), table badges `UNASSIGNED MANDOR`. (Screenshot: `uat_pic_1790842709557.png`).
- **ACC Page**: Verified `Sub: NISA` submitter indicator, `UNASSIGNED MANDOR` badge. (Screenshot: `uat_acc_1790842776377.png`).
- **Projects Page**: Verified `KANDIDAT — KONFIRMASI BISNIS` badge and `Induk potensial: INTERNAL` for candidate projects. (Screenshot: `uat_projects_1790842827169.png`).
- **Reports Page**: Verified ACC report totals `1,028 items`, `Rp 4.303.052.418` approved, `Rp 0` realization. (Screenshot: `uat_acc_report_1790842868591.png`).
- **WebP Session Recording**: `phase8c2_uat_1790842617688.webp`.

---

## H. FINAL STATUS

```text
PHASE 8C.2 FINAL STATUS:
PHASE 8C.2 — PASSED WITH REMAINING BUSINESS CONFIRMATIONS

Business confirmations remaining:
1. Field PIC assignments for 723 items (Rp 2.850.378.038) currently in UNASSIGNED_MANDOR
2. Cash account and authorization confirmation for candidate realization Rp 34.299.517
3. Final project parent assignment for 6 candidate projects (33 items, Rp 10.200.000)

Financial records modified:
0

Financial records deleted:
0

Nominal changes:
0

Test data deleted:
0

Phase 9:
NOT STARTED
```
