import { prisma } from "../src/lib/db/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { signSessionToken, verifySessionToken } from "../src/lib/auth/token";
import {
  authenticateUser,
  setupInitialAdmin,
  getAdminCount,
  requireAuth,
  requireAdmin,
} from "../src/lib/auth/auth.service";
import { voidDisbursementAction } from "../src/app/actions/disbursement.actions";
import { voidInflowAction } from "../src/app/actions/inflow.actions";
import { createProjectAction } from "../src/app/actions/master.actions";
import { previewExcelImportAction } from "../src/app/actions/import.actions";
import { UserRole, DataScope } from "@prisma/client";

async function main() {
  console.log("=================================================");
  console.log("  PROTRACK ADMSYSTEM - AUTH & RBAC SECURITY TEST");
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${name}${detail ? ` -> ${detail}` : ""}`);
      process.exitCode = 1;
    }
  }

  // --- Step 0: Record REAL Baseline Invariant ---
  const baselineBatchCount = await prisma.submissionBatch.count({ where: { dataScope: DataScope.REAL } });
  const baselineItemCount = await prisma.accExpenseItem.count({ where: { dataScope: DataScope.REAL } });
  const baselineItemSum = await prisma.accExpenseItem.aggregate({
    where: { dataScope: DataScope.REAL },
    _sum: { approvedAmount: true },
  });
  const baselineDisbursementCount = await prisma.disbursement.count({ where: { dataScope: DataScope.REAL } });
  const baselineInflowCount = await prisma.fundInflow.count({ where: { dataScope: DataScope.REAL } });
  const baselineJournalCount = await prisma.journalEntry.count({ where: { dataScope: DataScope.REAL } });

  console.log("Step 0: REAL Baseline Check");
  assert(baselineBatchCount === 379, `REAL batches count is 379 (actual: ${baselineBatchCount})`);
  assert(baselineItemCount === 1028, `REAL items count is 1028 (actual: ${baselineItemCount})`);
  assert(Number(baselineItemSum._sum.approvedAmount) === 4303052418, `REAL approved sum is 4.303.052.418 (actual: ${baselineItemSum._sum.approvedAmount})`);
  assert(baselineDisbursementCount === 0, `REAL disbursements count is 0 (actual: ${baselineDisbursementCount})`);
  assert(baselineInflowCount === 0, `REAL inflows count is 0 (actual: ${baselineInflowCount})`);
  assert(baselineJournalCount === 0, `REAL journals count is 0 (actual: ${baselineJournalCount})`);
  console.log("");

  // Test identifiers for clean isolation
  const TEST_ADMIN_USERNAME = "test_admin_qa_" + Date.now();
  const TEST_STAFF_USERNAME = "test_staff_qa_" + Date.now();
  const TEST_PASSWORD = "StrongSecurePassword123!";

  try {
    // --- Step 1: Password Hashing Verification ---
    console.log("Step 1: Cryptographic Password Hashing & Verification");
    const hashed = await hashPassword(TEST_PASSWORD);
    assert(hashed.includes(":"), "Password hash format contains salt:derivedKey separator");
    assert(hashed.split(":")[0].length === 32, "Salt is 16 bytes hex-encoded (32 chars)");
    
    const validMatch = await verifyPassword(TEST_PASSWORD, hashed);
    assert(validMatch === true, "Correct password verifies successfully");

    const invalidMatch = await verifyPassword("WrongPassword123!", hashed);
    assert(invalidMatch === false, "Incorrect password is decisively rejected");
    console.log("");

    // --- Step 2: Session Token Signing & Verification ---
    console.log("Step 2: HMAC Session Token Verification");
    const samplePayload = {
      sub: "mock-user-id",
      username: "testuser",
      fullName: "Test User",
      role: UserRole.ADMIN,
      iat: Date.now(),
      exp: Date.now() + 3600 * 1000,
    };
    const token = await signSessionToken(samplePayload);
    assert(typeof token === "string" && token.length > 20, "Session token successfully signed");

    const verified = await verifySessionToken(token);
    assert(verified !== null && verified.username === "testuser" && verified.role === UserRole.ADMIN, "Valid token decoded with exact claims");

    // Tampered token test
    const tamperedToken = token.slice(0, -4) + "abcd";
    const tamperedResult = await verifySessionToken(tamperedToken);
    assert(tamperedResult === null, "Tampered token is rejected by HMAC signature verification");

    // Expired token test
    const expiredPayload = {
      sub: "mock-user-id",
      username: "testuser",
      fullName: "Test User",
      role: UserRole.ADMIN,
      iat: Date.now() - 7200 * 1000,
      exp: Date.now() - 3600 * 1000,
    };
    const expiredToken = await signSessionToken(expiredPayload);
    const expiredResult = await verifySessionToken(expiredToken);
    assert(expiredResult === null, "Expired token is rejected");
    console.log("");

    // --- Step 3: Initial Admin Setup & Gating ---
    console.log("Step 3: Initial Admin Setup & Gating");
    const currentAdminCount = await getAdminCount();

    if (currentAdminCount === 0) {
      const setupRes = await setupInitialAdmin({
        username: TEST_ADMIN_USERNAME,
        password: TEST_PASSWORD,
        fullName: "Test Admin QA",
      });
      assert(setupRes.success && setupRes.user?.role === UserRole.ADMIN, "Initial admin created with ADMIN role when adminCount === 0");

      // Attempt second setup -> should return error
      const secondRes = await setupInitialAdmin({
        username: "second_admin",
        password: TEST_PASSWORD,
        fullName: "Second Admin",
      });
      assert(!secondRes.success && (secondRes.error?.includes("telah memiliki Administrator") ?? false), "Subsequent setupInitialAdmin is strictly blocked once an admin exists");
    } else {
      console.log(`  (Admin count is already ${currentAdminCount}, verifying setupInitialAdmin is blocked)`);
      const blockedRes = await setupInitialAdmin({
        username: "second_admin",
        password: TEST_PASSWORD,
        fullName: "Second Admin",
      });
      assert(!blockedRes.success, "setupInitialAdmin is blocked when adminCount > 0");

      // Create test admin directly for subsequent testing
      const passwordHash = await hashPassword(TEST_PASSWORD);
      await prisma.user.create({
        data: {
          username: TEST_ADMIN_USERNAME,
          passwordHash,
          fullName: "Test Admin QA",
          role: UserRole.ADMIN,
          isActive: true,
        },
      });
    }
    console.log("");

    // --- Step 4: Authentication & Login Flow ---
    console.log("Step 4: User Authentication & Login Verification");
    // Create test staff user
    const staffHash = await hashPassword(TEST_PASSWORD);
    const testStaff = await prisma.user.create({
      data: {
        username: TEST_STAFF_USERNAME,
        passwordHash: staffHash,
        fullName: "Test Staff Kasir QA",
        role: UserRole.STAFF,
        isActive: true,
      },
    });
    assert(testStaff.role === UserRole.STAFF, "Test staff user created with STAFF role");

    // Authenticate with valid credentials
    const authStaff = await authenticateUser(TEST_STAFF_USERNAME, TEST_PASSWORD);
    assert(authStaff.success && authStaff.user?.role === UserRole.STAFF, "Staff login returns valid user and role");

    // Authenticate with invalid password
    const badPassRes = await authenticateUser(TEST_STAFF_USERNAME, "IncorrectPassword!");
    assert(!badPassRes.success, "Login with incorrect password returns failure");

    // Authenticate with non-existent username
    const nonExistRes = await authenticateUser("non_existent_user_99999", TEST_PASSWORD);
    assert(!nonExistRes.success, "Login with non-existent username returns failure");

    // Deactivated user check
    await prisma.user.update({
      where: { id: testStaff.id },
      data: { isActive: false },
    });
    const deactRes = await authenticateUser(TEST_STAFF_USERNAME, TEST_PASSWORD);
    assert(!deactRes.success, "Inactive/deactivated user is blocked from logging in");

    // Re-activate staff
    await prisma.user.update({
      where: { id: testStaff.id },
      data: { isActive: true },
    });
    console.log("");

    // --- Step 5: Server-Enforced RBAC Authorization ---
    console.log("Step 5: Server-Enforced RBAC Authorization on Server Actions & Guards");

    // Test unauthenticated access (no session token)
    let unauthGuardFailed = false;
    try {
      await requireAuth();
    } catch (err: unknown) {
      unauthGuardFailed = true;
    }
    assert(unauthGuardFailed, "Unauthenticated requireAuth() throws access denied error");

    let unauthAdminGuardFailed = false;
    try {
      await requireAdmin();
    } catch {
      unauthAdminGuardFailed = true;
    }
    assert(unauthAdminGuardFailed, "Unauthenticated requireAdmin() throws access denied error");

    // Create session token for STAFF
    const staffToken = await signSessionToken({
      sub: testStaff.id,
      username: testStaff.username,
      fullName: testStaff.fullName,
      role: UserRole.STAFF,
      iat: Date.now(),
      exp: Date.now() + 3600 * 1000,
    });

    // STAFF passes requireAuth
    const staffUser = await requireAuth(staffToken);
    assert(staffUser.role === UserRole.STAFF, "STAFF token passes requireAuth() successfully");

    // STAFF is blocked by requireAdmin
    let staffBlockedByAdminGuard = false;
    try {
      await requireAdmin(staffToken);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Administrator")) {
        staffBlockedByAdminGuard = true;
      }
    }
    assert(staffBlockedByAdminGuard, "STAFF token is strictly rejected by requireAdmin() with administrator error");

    // ADMIN passes requireAdmin
    const testAdmin = await prisma.user.findUnique({ where: { username: TEST_ADMIN_USERNAME } });
    assert(testAdmin !== null, "Test admin user found in database");

    const adminToken = await signSessionToken({
      sub: testAdmin!.id,
      username: testAdmin!.username,
      fullName: testAdmin!.fullName,
      role: UserRole.ADMIN,
      iat: Date.now(),
      exp: Date.now() + 3600 * 1000,
    });

    const adminUser = await requireAdmin(adminToken);
    assert(adminUser.role === UserRole.ADMIN, "ADMIN token passes requireAdmin() successfully");

    // Test unauthenticated server action calls
    let unauthVoidDisbFailed = false;
    try {
      const disbFormData = new FormData();
      disbFormData.append("disbursementId", "dummy-id");
      disbFormData.append("voidReason", "Testing unauthenticated void");
      const res = await voidDisbursementAction(disbFormData);
      if (res && "error" in res && res.error) {
        unauthVoidDisbFailed = true;
      }
    } catch {
      unauthVoidDisbFailed = true;
    }
    assert(unauthVoidDisbFailed, "Unauthenticated call to voidDisbursementAction is rejected");

    let unauthVoidInflowFailed = false;
    try {
      const inflowFormData = new FormData();
      inflowFormData.append("inflowId", "dummy-id");
      inflowFormData.append("voidReason", "Testing unauthenticated void");
      const res = await voidInflowAction(inflowFormData);
      if (res && "error" in res && res.error) {
        unauthVoidInflowFailed = true;
      }
    } catch {
      unauthVoidInflowFailed = true;
    }
    assert(unauthVoidInflowFailed, "Unauthenticated call to voidInflowAction is rejected");

    let unauthImportFailed = false;
    const fakeFormData = new FormData();
    try {
      const res = await previewExcelImportAction(fakeFormData);
      if (!res.success) unauthImportFailed = true;
    } catch {
      unauthImportFailed = true;
    }
    assert(unauthImportFailed, "Unauthenticated call to previewExcelImportAction is rejected");

    let unauthCreateProjectFailed = false;
    const projectFormData = new FormData();
    projectFormData.append("code", "SEC-PRJ");
    projectFormData.append("name", "Security Project");
    try {
      await createProjectAction(projectFormData);
    } catch {
      unauthCreateProjectFailed = true;
    }
    assert(unauthCreateProjectFailed, "Unauthenticated call to createProjectAction is rejected");
    console.log("");

  } finally {
    // --- Step 6: Clean Up Test Fixtures ---
    console.log("Step 6: Teardown & Invariant Verification");
    await prisma.user.deleteMany({
      where: {
        username: { in: [TEST_ADMIN_USERNAME, TEST_STAFF_USERNAME, "second_admin"] },
      },
    });
    console.log("  Cleaned up all temporary test users.");

    // Verify REAL baseline remains 100% unmutated
    const postBatchCount = await prisma.submissionBatch.count({ where: { dataScope: DataScope.REAL } });
    const postItemCount = await prisma.accExpenseItem.count({ where: { dataScope: DataScope.REAL } });
    const postItemSum = await prisma.accExpenseItem.aggregate({
      where: { dataScope: DataScope.REAL },
      _sum: { approvedAmount: true },
    });
    const postDisbursementCount = await prisma.disbursement.count({ where: { dataScope: DataScope.REAL } });
    const postInflowCount = await prisma.fundInflow.count({ where: { dataScope: DataScope.REAL } });
    const postJournalCount = await prisma.journalEntry.count({ where: { dataScope: DataScope.REAL } });

    assert(postBatchCount === baselineBatchCount, "REAL batches count unmutated (379)");
    assert(postItemCount === baselineItemCount, "REAL items count unmutated (1028)");
    assert(Number(postItemSum._sum.approvedAmount) === Number(baselineItemSum._sum.approvedAmount), "REAL approved sum unmutated (Rp4.303.052.418)");
    assert(postDisbursementCount === 0, "REAL disbursements count unmutated (0)");
    assert(postInflowCount === 0, "REAL inflows count unmutated (0)");
    assert(postJournalCount === 0, "REAL journals count unmutated (0)");

    console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
    if (passedTests === totalTests) {
      console.log("ALL AUTHENTICATION & RBAC SECURITY TESTS PASSED.");
    } else {
      console.error("SOME TESTS FAILED.");
    }
  }
}

main()
  .catch((e) => {
    console.error("FATAL ERROR IN SECURITY TEST:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
