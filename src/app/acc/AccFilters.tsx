"use client";

import { useRouter, usePathname } from "next/navigation";
import { SearchIcon } from "../components/Icons";

interface AccFiltersProps {
  projects: { id: string; code: string; name: string }[];
  currentFilters: { status?: string; projectId?: string; search?: string };
}

export default function AccFilters({ projects, currentFilters }: AccFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams();
    const current = { ...currentFilters, [key]: value };

    Object.entries(current).forEach(([k, v]) => {
      if (v && v !== "") params.set(k, v);
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    router.push(pathname);
  };

  const hasActiveFilters = !!(currentFilters.status || currentFilters.projectId || currentFilters.search);

  return (
    <div className="filter-bar">
      <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
        <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)", display: "flex", alignItems: "center" }}>
          <SearchIcon size={14} />
        </div>
        <input
          type="text"
          className="form-input"
          placeholder="Cari No Kas / Uraian..."
          defaultValue={currentFilters.search || ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateFilters("search", (e.target as HTMLInputElement).value);
            }
          }}
          style={{ paddingLeft: 30 }}
        />
      </div>

      <div className="filter-item">
        <select
          className="form-select"
          value={currentFilters.status || ""}
          onChange={(e) => updateFilters("status", e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="APPROVED">Approved (Belum Cair)</option>
          <option value="PARTIALLY_REALIZED">Sebagian Cair</option>
          <option value="FULLY_REALIZED">Lunas</option>
          <option value="CANCELLED">Batal</option>
        </select>
      </div>

      <div className="filter-item">
        <select
          className="form-select"
          value={currentFilters.projectId || ""}
          onChange={(e) => updateFilters("projectId", e.target.value)}
        >
          <option value="">Semua Proyek</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="btn btn-ghost btn-sm text-xs"
          style={{ color: "var(--slate-500)" }}
        >
          Reset Filter
        </button>
      )}
    </div>
  );
}
