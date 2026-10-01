/**
 * Format number as Indonesian Rupiah currency string.
 */
export function formatRupiah(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a date string or Date object to Indonesian locale display.
 */
export function formatDate(date: Date | string | null, includeTime = false): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  return d.toLocaleDateString("id-ID", options);
}

/**
 * Map AccStatus enum to human-readable labels.
 */
export function accStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "APPROVED":
      return { label: "Approved", className: "status-approved" };
    case "PARTIALLY_REALIZED":
      return { label: "Sebagian Cair", className: "status-partial" };
    case "FULLY_REALIZED":
      return { label: "Lunas", className: "status-realized" };
    case "CANCELLED":
      return { label: "Batal", className: "status-cancelled" };
    default:
      return { label: status, className: "" };
  }
}

/**
 * Map TransactionStatus enum to human-readable labels.
 */
export function txStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "POSTED":
      return { label: "Posted", className: "status-posted" };
    case "VOID":
      return { label: "Void", className: "status-void" };
    default:
      return { label: status, className: "" };
  }
}
