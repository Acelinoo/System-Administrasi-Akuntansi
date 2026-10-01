"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ExportButtonsInner({ reportType }: { reportType: string }) {
  const searchParams = useSearchParams();

  const getExportUrl = (format: "excel" | "pdf") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", reportType);
    return `/api/export/${format}?${params.toString()}`;
  };

  return (
    <div className="flex gap-2">
      <a
        href={getExportUrl("excel")}
        className="btn btn-secondary btn-sm"
        download
        title="Download spreadsheet Microsoft Excel (.xlsx)"
        style={{ textDecoration: "none" }}
      >
        <span>📊</span>
        <span>Export Excel</span>
      </a>
      <a
        href={getExportUrl("pdf")}
        className="btn btn-secondary btn-sm"
        download
        title="Download dokumen cetak PDF (.pdf)"
        style={{ textDecoration: "none" }}
      >
        <span>📄</span>
        <span>Export PDF</span>
      </a>
    </div>
  );
}

export default function ExportButtons({ reportType }: { reportType: string }) {
  return (
    <Suspense fallback={<div className="text-xs text-muted">Memuat opsi export...</div>}>
      <ExportButtonsInner reportType={reportType} />
    </Suspense>
  );
}
