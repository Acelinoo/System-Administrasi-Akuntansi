"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface OptionItem {
  id: string;
  name: string;
}

interface FilterBarConfig {
  showDates?: boolean;
  projects?: OptionItem[];
  subUnits?: (OptionItem & { projectId?: string })[];
  categories?: OptionItem[];
  pics?: OptionItem[];
  accounts?: OptionItem[];
  statuses?: { value: string; label: string }[];
  sourceTypes?: { value: string; label: string }[];
}

function ReportFilterBarInner({ config }: { config: FilterBarConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getVal = (key: string) => searchParams.get(key) || "ALL";

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    router.push(pathname);
  };

  return (
    <div className="filter-bar mb-6" style={{ flexWrap: "wrap", gap: 12 }}>
      {config.showDates && (
        <>
          <div className="filter-item">
            <label className="form-label text-xs">Mulai Tanggal</label>
            <input
              type="date"
              className="form-control"
              style={{ fontSize: "0.82rem", padding: "4px 8px" }}
              value={searchParams.get("startDate") || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label className="form-label text-xs">Sampai Tanggal</label>
            <input
              type="date"
              className="form-control"
              style={{ fontSize: "0.82rem", padding: "4px 8px" }}
              value={searchParams.get("endDate") || ""}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>
        </>
      )}

      {config.projects && (
        <div className="filter-item">
          <label className="form-label text-xs">Proyek</label>
          <select
            className="form-control"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
            value={getVal("projectId")}
            onChange={(e) => handleFilterChange("projectId", e.target.value)}
          >
            <option value="ALL">Semua Proyek</option>
            {config.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.subUnits && (
        <div className="filter-item">
          <label className="form-label text-xs">Sub-Unit / Sub-Proyek</label>
          <select
            className="form-control"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
            value={getVal("subUnitId")}
            onChange={(e) => handleFilterChange("subUnitId", e.target.value)}
          >
            <option value="ALL">Semua Sub-Unit</option>
            {config.subUnits
              .filter((s) => {
                const currentProj = getVal("projectId");
                return !s.projectId || currentProj === "ALL" || s.projectId === currentProj;
              })
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {config.categories && (
        <div className="filter-item">
          <label className="form-label text-xs">Kategori Biaya</label>
          <select
            className="form-control"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
            value={getVal("categoryId")}
            onChange={(e) => handleFilterChange("categoryId", e.target.value)}
          >
            <option value="ALL">Semua Kategori</option>
            {config.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.pics && (
        <div className="filter-item">
          <label className="form-label text-xs">PIC Lapangan</label>
          <select
            className="form-control"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
            value={getVal("picId")}
            onChange={(e) => handleFilterChange("picId", e.target.value)}
          >
            <option value="ALL">Semua PIC</option>
            {config.pics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.accounts && (
        <div className="filter-item">
          <label className="form-label text-xs">Akun Kas / Bank</label>
          <select
            className="form-control"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
            value={getVal("cashAccountId")}
            onChange={(e) => handleFilterChange("cashAccountId", e.target.value)}
          >
            <option value="ALL">Semua Akun</option>
            {config.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.statuses && (
        <div className="filter-item">
          <label className="form-label text-xs">Status</label>
          <select
            className="form-control"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
            value={getVal("status")}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="ALL">Semua Status</option>
            {config.statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.sourceTypes && (
        <div className="filter-item">
          <label className="form-label text-xs">Sumber Jurnal</label>
          <select
            className="form-control"
            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
            value={getVal("sourceType")}
            onChange={(e) => handleFilterChange("sourceType", e.target.value)}
          >
            <option value="ALL">Semua Sumber</option>
            {config.sourceTypes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-item" style={{ alignSelf: "flex-end" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleReset}
          style={{ fontSize: "0.75rem", padding: "5px 10px" }}
        >
          Reset Filter
        </button>
      </div>
    </div>
  );
}

export default function ReportFilterBar({ config }: { config: FilterBarConfig }) {
  return (
    <Suspense fallback={<div className="filter-bar mb-6 text-xs text-muted">Memuat filter...</div>}>
      <ReportFilterBarInner config={config} />
    </Suspense>
  );
}
