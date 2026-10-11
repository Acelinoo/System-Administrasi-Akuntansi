import { prisma } from "../db/prisma";
import { UserRole } from "@prisma/client";
import { hashPassword, verifyPassword } from "./password";
import { getSessionFromCookies, setSessionCookie, clearSessionCookie } from "./session";
import { verifySessionToken } from "./token";

import { checkLoginRateLimit, recordFailedLoginAttempt, resetLoginRateLimit } from "./rate-limit";

export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Retrieves the currently authenticated user by validating the session cookie (or optional token)
 * and verifying against the database to ensure active status and authoritative role.
 */
export async function getCurrentUser(tokenOverride?: string): Promise<AuthenticatedUser | null> {
  const session = tokenOverride ? await verifySessionToken(tokenOverride) : await getSessionFromCookies();
  if (!session) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      // Deactivated or deleted user: clear cookie immediately if in cookie context
      if (!tokenOverride) {
        await clearSessionCookie();
      }
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Server guard: requires that the caller is authenticated.
 * Throws a clean error if unauthenticated.
 */
export async function requireAuth(tokenOverride?: string): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(tokenOverride);
  if (!user) {
    throw new Error("Akses ditolak: Anda harus login terlebih dahulu.");
  }
  return user;
}

/**
 * Server guard: requires that the caller has ADMIN role.
 * Throws a clean error if unauthenticated or if role is STAFF.
 */
export async function requireAdmin(tokenOverride?: string): Promise<AuthenticatedUser> {
  const user = await requireAuth(tokenOverride);
  if (user.role !== UserRole.ADMIN) {
    throw new Error("Akses ditolak: Operasi ini memerlukan hak akses Administrator.");
  }
  return user;
}

/**
 * Authenticates user with username & password, sets session cookie, and updates lastLoginAt.
 * Protected with sliding-window rate limiting against brute-force attacks.
 */
export async function authenticateUser(
  usernameRaw: string,
  passwordRaw: string,
  clientIp?: string
): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
  const username = usernameRaw.trim().toLowerCase();
  const password = passwordRaw;

  if (!username || !password) {
    return { success: false, error: "Username dan password wajib diisi." };
  }

  const rateKey = clientIp ? `${clientIp}:${username}` : username;
  const rateStatus = checkLoginRateLimit(rateKey);
  if (!rateStatus.allowed) {
    return {
      success: false,
      error: `Terlalu banyak percobaan login yang gagal. Akses sementara dikunci selama ${rateStatus.retryAfterSeconds} detik.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || !user.isActive) {
    recordFailedLoginAttempt(rateKey);
    return { success: false, error: "Username atau password salah." };
  }

  if (!user.passwordHash) {
    return {
      success: false,
      error: "Akun ini belum memiliki password. Silakan hubungi Administrator untuk mengatur password Anda.",
    };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    const lockResult = recordFailedLoginAttempt(rateKey);
    if (lockResult.isLocked) {
      return {
        success: false,
        error: `Terlalu banyak percobaan login yang gagal. Akses sementara dikunci selama ${lockResult.retryAfterSeconds} detik.`,
      };
    }
    return { success: false, error: "Username atau password salah." };
  }

  // Clear failed attempts on successful authentication
  resetLoginRateLimit(rateKey);

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const authUser: AuthenticatedUser = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  };

  await setSessionCookie(authUser);

  return { success: true, user: authUser };
}

/**
 * Logs out the current user by clearing the session cookie.
 */
export async function logoutUser(): Promise<void> {
  await clearSessionCookie();
}

/**
 * Checks how many admins exist in the database (active or historical).
 * Used to permanently seal the initial setup door once an administrator is created.
 */
export async function getAdminCount(): Promise<number> {
  return await prisma.user.count({
    where: { role: UserRole.ADMIN },
  });
}

/**
 * Safe initial system setup: Allows creating the first ADMIN user if and only if
 * there are zero administrators in the database.
 * Wrapped in an atomic transaction to prevent race conditions during simultaneous setup requests.
 */
export async function setupInitialAdmin(data: {
  username: string;
  fullName: string;
  password: string;
}): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
  const username = data.username.trim().toLowerCase();
  const fullName = data.fullName.trim();
  const password = data.password;

  if (!username || username.length < 3) {
    return { success: false, error: "Username minimal 3 karakter." };
  }
  if (!fullName || fullName.length < 3) {
    return { success: false, error: "Nama lengkap minimal 3 karakter." };
  }
  if (!password || password.length < 8) {
    return { success: false, error: "Password wajib minimal 8 karakter." };
  }

  const hashedPassword = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const adminCount = await tx.user.count({
      where: { role: UserRole.ADMIN },
    });
    if (adminCount > 0) {
      return {
        success: false as const,
        error: "Sistem telah memiliki Administrator. Fitur setup awal ditutup.",
      };
    }

    const existing = await tx.user.findUnique({ where: { username } });
    if (existing) {
      return { success: false as const, error: "Username sudah digunakan." };
    }

    const newUser = await tx.user.create({
      data: {
        username,
        fullName,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
        lastLoginAt: new Date(),
      },
    });

    const authUser: AuthenticatedUser = {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      role: newUser.role,
      isActive: newUser.isActive,
    };

    return { success: true as const, user: authUser };
  });

  if (result.success && result.user) {
    await setSessionCookie(result.user);
  }

  return result;
}
