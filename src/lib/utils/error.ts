/**
 * Error Sanitization Utility
 * Prevents sensitive internal infrastructure details (Prisma internals, database hostnames,
 * SQL queries, or credentials) from leaking to client responses.
 */

export function sanitizeErrorMessage(err: unknown, fallback = "Terjadi kesalahan pada server."): string {
  if (err instanceof Error) {
    const msg = err.message;
    // Filter out internal database / ORM / driver error signatures
    if (
      msg.toLowerCase().includes("prisma") ||
      msg.toLowerCase().includes("neon.tech") ||
      msg.toLowerCase().includes("postgresql://") ||
      msg.toLowerCase().includes("database server at") ||
      msg.toLowerCase().includes("can't reach database") ||
      msg.toLowerCase().includes("p1001") ||
      msg.toLowerCase().includes("p2002") ||
      msg.toLowerCase().includes("queryraw")
    ) {
      return "Terjadi gangguan koneksi basis data. Silakan coba beberapa saat lagi.";
    }
    return msg;
  }
  return fallback;
}
