import { cookies } from "next/headers";
import { SessionPayload, signSessionToken, verifySessionToken } from "./token";

export const SESSION_COOKIE_NAME = "protrack_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates and saves an authenticated session cookie.
 */
export async function setSessionCookie(user: {
  id: string;
  username: string;
  fullName: string;
  role: "STAFF" | "ADMIN";
}): Promise<string> {
  const now = Date.now();
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    iat: now,
    exp: now + SESSION_DURATION_MS,
  };

  const token = await signSessionToken(payload);
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });
  } catch {
    // Graceful fallback when executed outside Next.js request store (e.g. CLI tests)
  }

  return token;
}

/**
 * Clears the session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch {
    // Graceful fallback when executed outside Next.js request store
  }
}

/**
 * Retrieves and validates the current session token from request cookies.
 * Returns decoded SessionPayload or null.
 */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
