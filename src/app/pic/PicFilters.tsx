"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface PicFiltersProps {
  pics: { id: string; name: string }[];
  projects: { id: string; code: string; name: string }[];
}

export default function PicFilters({ pics, projects }: PicFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPic = searchParams.get("picId") || "ALL";
  const currentProject = searchParams.get("projectId") || "ALL";
  const currentStatus = searchParams.get("status") || "ALL";

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/pic?${params.toString()}`);
  };

  return (
    <div className="filter-bar mb-6">
      <div className="filter-item">
        <label className="form-label text-xs">Pilih PIC</label>
        <select
          className="form-control"
          value={currentPic}
          onChange={(e) => updateFilter("picId", e.target.value)}
        >
          <option value="ALL">Semua PIC ({pics.length})</option>
          {pics.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-item">
        <label className="form-label text-xs">Proyek</label>
        <select
          className="form-control"
          value={currentProject}
          onChange={(e) => updateFilter("projectId", e.target.value)}
        >
          <option value="ALL">Semua Proyek</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} - {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-item">
        <label className="form-label text-xs">Status Realisasi</label>
        <select
          className="form-control"
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <option value="ALL">Semua Status</option>
          <option value="APPROVED">Belum Dicairkan (APPROVED)</option>
          <option value="PARTIALLY_REALIZED">Dicairkan Sebagian</option>
          <option value="FULLY_REALIZED">Lunas (FULLY REALIZED)</option>
        </select>
      </div>
    </div>
  );
}
