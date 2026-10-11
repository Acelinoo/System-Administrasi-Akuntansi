export interface SessionPayload {
  sub: string; // userId
  username: string;
  fullName: string;
  role: "STAFF" | "ADMIN";
  exp: number; // expiration timestamp in milliseconds
  iat: number; // issued at timestamp in milliseconds
}

const DEFAULT_SECRET = "protrack-default-dev-secret-replace-with-auth-secret-in-env-2026";

function getAuthSecret(): string {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    throw new Error(
      "SECURITY ERROR: AUTH_SECRET wajib diset pada environment produksi. Dilarang menggunakan default secret di server publik."
    );
  }
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

/**
 * Signs a payload into an HMAC-SHA256 signed token.
 * Compatible with both Node.js and Next.js Edge/Middleware runtimes.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  const base64Data = typeof Buffer !== "undefined"
    ? Buffer.from(jsonStr, "utf-8").toString("base64url")
    : btoa(jsonStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const secret = getAuthSecret();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(base64Data));
  const sigHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${base64Data}.${sigHex}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed token.
 * Returns decoded SessionPayload or null if invalid or expired.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [base64Data, providedSigHex] = parts;
  if (!base64Data || !providedSigHex) return null;

  try {
    const secret = getAuthSecret();
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expectedSigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(base64Data));
    const expectedSigHex = Array.from(new Uint8Array(expectedSigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSigHex.length !== providedSigHex.length) return null;

    // Timing-safe constant-time string comparison
    let diff = 0;
    for (let i = 0; i < expectedSigHex.length; i++) {
      diff |= expectedSigHex.charCodeAt(i) ^ providedSigHex.charCodeAt(i);
    }
    if (diff !== 0) return null;

    // Decode base64 payload
    const jsonStr = typeof Buffer !== "undefined"
      ? Buffer.from(base64Data, "base64url").toString("utf-8")
      : atob(base64Data.replace(/-/g, "+").replace(/_/g, "/"));

    const payload: SessionPayload = JSON.parse(jsonStr);

    // Verify expiration
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
