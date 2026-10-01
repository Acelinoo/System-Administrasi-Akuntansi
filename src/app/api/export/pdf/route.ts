import { NextRequest, NextResponse } from "next/server";
import { getAccReport } from "@/lib/reports/acc-report.service";
import { getRealizationReport } from "@/lib/reports/realization-report.service";
import { getProjectReport } from "@/lib/reports/project-report.service";
import { getPicReport } from "@/lib/reports/pic-report.service";
import { getCashReport } from "@/lib/reports/cash-report.service";
import { getJournalReport } from "@/lib/reports/journal-report.service";
import {
  buildAccPdf,
  buildRealizationPdf,
  buildProjectPdf,
  buildPicPdf,
  buildCashPdf,
  buildJournalPdf,
} from "@/lib/export/pdf-export.service";

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
    let filename = `ProTrack_Dokumen_${dateTag}.pdf`;

    switch (type) {
      case "acc": {
        const data = await getAccReport({ startDate, endDate, projectId, subUnitId, categoryId, picId, status, dataScope });
        bytes = await buildAccPdf(data);
        filename = `ProTrack_Rekap_ACC_${dateTag}.pdf`;
        break;
      }
      case "realization": {
        const data = await getRealizationReport({ startDate, endDate, projectId, picId, cashAccountId, status, dataScope });
        bytes = await buildRealizationPdf(data);
        filename = `ProTrack_Realisasi_${dateTag}.pdf`;
        break;
      }
      case "project": {
        const data = await getProjectReport({ startDate, endDate, projectId, dataScope });
        bytes = await buildProjectPdf(data);
        filename = `ProTrack_Per_Project_${dateTag}.pdf`;
        break;
      }
      case "pic": {
        const data = await getPicReport({ startDate, endDate, picId, projectId, status, dataScope });
        bytes = await buildPicPdf(data);
        filename = `ProTrack_Per_PIC_${dateTag}.pdf`;
        break;
      }
      case "cash": {
        const data = await getCashReport({ dataScope });
        bytes = await buildCashPdf(data);
        filename = `ProTrack_Kas_Bank_${dateTag}.pdf`;
        break;
      }
      case "journal": {
        const data = await getJournalReport({ startDate, endDate, sourceType, status, coaId, dataScope });
        bytes = await buildJournalPdf(data);
        filename = `ProTrack_Jurnal_${dateTag}.pdf`;
        break;
      }
      default:
        return NextResponse.json({ error: `Tipe export '${type}' tidak dikenal.` }, { status: 400 });
    }

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengenerate file PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
