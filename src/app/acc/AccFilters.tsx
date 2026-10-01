"use client";

import { useRouter, usePathname } from "next/navigation";

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

  return (
    <div className="filters-bar" style={{ margin: "0 var(--space-8)", marginTop: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
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
        style={{ minWidth: 200 }}
      />

      <select
        className="form-select"
        value={currentFilters.status || ""}
        onChange={(e) => updateFilters("status", e.target.value)}
      >
        <option value="">Semua Status</option>
        <option value="APPROVED">Approved</option>
        <option value="PARTIALLY_REALIZED">Sebagian Cair</option>
        <option value="FULLY_REALIZED">Lunas</option>
        <option value="CANCELLED">Batal</option>
      </select>

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
  );
}
