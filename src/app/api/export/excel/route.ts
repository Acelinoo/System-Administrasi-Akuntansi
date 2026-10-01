import { NextRequest, NextResponse } from "next/server";
import { getAccReport } from "@/lib/reports/acc-report.service";
import { getRealizationReport } from "@/lib/reports/realization-report.service";
import { getProjectReport } from "@/lib/reports/project-report.service";
import { getPicReport } from "@/lib/reports/pic-report.service";
import { getCashReport } from "@/lib/reports/cash-report.service";
import { getJournalReport } from "@/lib/reports/journal-report.service";
import {
  buildAccExcel,
  buildRealizationExcel,
  buildProjectExcel,
  buildPicExcel,
  buildCashExcel,
  buildJournalExcel,
} from "@/lib/export/excel-export.service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "acc";
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const subUnitId = searchParams.get("subUnitId") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const picId = searchParams.get("picId") || undefined;
  const cashAccountId = searchParams.get("cashAccountId") || undefined;
  const status = searchParams.get("status") || undefined;
  const sourceType = searchParams.get("sourceType") || undefined;
  const coaId = searchParams.get("coaId") || undefined;
  const dataScope = searchParams.get("dataScope") || undefined;

  const dateTag = new Date().toISOString().slice(0, 10);

  try {
    let bytes: Uint8Array;
    let filename = `ProTrack_Export_${dateTag}.xlsx`;

    switch (type) {
      case "acc": {
        const data = await getAccReport({ startDate, endDate, projectId, subUnitId, categoryId, picId, status, dataScope });
        bytes = await buildAccExcel(data);
        filename = `ProTrack_Rekap_ACC_${dateTag}.xlsx`;
        break;
      }
      case "realization": {
        const data = await getRealizationReport({ startDate, endDate, projectId, picId, cashAccountId, status, dataScope });
        bytes = await buildRealizationExcel(data);
        filename = `ProTrack_Realisasi_${dateTag}.xlsx`;
        break;
      }
      case "project": {
        const data = await getProjectReport({ startDate, endDate, projectId, dataScope });
        bytes = await buildProjectExcel(data);
        filename = `ProTrack_Per_Project_${dateTag}.xlsx`;
        break;
      }
      case "pic": {
        const data = await getPicReport({ startDate, endDate, picId, projectId, status, dataScope });
        bytes = await buildPicExcel(data);
        filename = `ProTrack_Per_PIC_${dateTag}.xlsx`;
        break;
      }
      case "cash": {
        const data = await getCashReport({ dataScope });
        bytes = await buildCashExcel(data);
        filename = `ProTrack_Kas_Bank_${dateTag}.xlsx`;
        break;
      }
      case "journal": {
        const data = await getJournalReport({ startDate, endDate, sourceType, status, coaId, dataScope });
        bytes = await buildJournalExcel(data);
        filename = `ProTrack_Jurnal_${dateTag}.xlsx`;
        break;
      }
      default:
        return NextResponse.json({ error: `Tipe export '${type}' tidak dikenal.` }, { status: 400 });
    }

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengenerate file Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
