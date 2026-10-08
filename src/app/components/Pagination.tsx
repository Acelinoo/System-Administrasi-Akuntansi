import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  basePath,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1 && totalItems <= pageSize) {
    return null;
  }

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== "" && key !== "page") {
        params.set(key, value);
      }
    }
    if (pageNumber > 1) {
      params.set("page", String(pageNumber));
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("...");
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push("...");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderTop: "1px solid var(--color-border-subtle)",
        fontSize: "0.8125rem",
        color: "var(--color-text-secondary)",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <div>
        Menampilkan{" "}
        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {startItem.toLocaleString("id-ID")}
        </span>{" "}
        –{" "}
        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {endItem.toLocaleString("id-ID")}
        </span>{" "}
        dari{" "}
        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {totalItems.toLocaleString("id-ID")}
        </span>{" "}
        data
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {currentPage > 1 ? (
          <Link
            href={createPageUrl(currentPage - 1)}
            className="btn btn-secondary btn-sm"
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            ← Sebelumnya
          </Link>
        ) : (
          <button
            disabled
            className="btn btn-secondary btn-sm"
            style={{ padding: "4px 10px", fontSize: "0.75rem", opacity: 0.5, cursor: "not-allowed" }}
          >
            ← Sebelumnya
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "2px", margin: "0 4px" }}>
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{ padding: "0 6px", color: "var(--color-text-muted)" }}
                >
                  …
                </span>
              );
            }
            const pageNum = p as number;
            const isActive = pageNum === currentPage;
            return (
              <Link
                key={`page-${pageNum}`}
                href={createPageUrl(pageNum)}
                style={{
                  minWidth: "28px",
                  height: "28px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "var(--color-primary)" : "transparent",
                  color: isActive ? "#ffffff" : "var(--color-text)",
                  border: isActive ? "1px solid var(--color-primary)" : "1px solid transparent",
                  textDecoration: "none",
                  transition: "background 0.15s ease",
                }}
              >
                {pageNum}
              </Link>
            );
          })}
        </div>

        {currentPage < totalPages ? (
          <Link
            href={createPageUrl(currentPage + 1)}
            className="btn btn-secondary btn-sm"
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            Berikutnya →
          </Link>
        ) : (
          <button
            disabled
            className="btn btn-secondary btn-sm"
            style={{ padding: "4px 10px", fontSize: "0.75rem", opacity: 0.5, cursor: "not-allowed" }}
          >
            Berikutnya →
          </button>
        )}
      </div>
    </div>
  );
}
