/**
 * In-memory sliding-window rate limiter for brute-force login protection.
 * Protects ProTrack authentication endpoints from automated password-guessing attacks.
 */

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

/**
 * Checks if the given key (IP address or username) is allowed to attempt login.
 */
export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // Check if locked out
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  // Check if window has expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  const allowed = remaining > 0;
  return {
    allowed,
    remainingAttempts: remaining,
    retryAfterSeconds: allowed ? 0 : Math.ceil((record.firstAttemptAt + WINDOW_MS - now) / 1000),
  };
}

/**
 * Records a failed login attempt and locks out the client if threshold is reached.
 */
export function recordFailedLoginAttempt(key: string): {
  isLocked: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    loginAttempts.set(key, {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
    });
    return { isLocked: false, retryAfterSeconds: 0 };
  }

  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    return { isLocked: true, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  return { isLocked: false, retryAfterSeconds: 0 };
}

/**
 * Clears failed attempts upon a successful login.
 */
export function resetLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}
