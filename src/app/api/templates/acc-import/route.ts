import { NextResponse } from "next/server";
import { generateAccImportTemplate } from "@/lib/finance/import.service";

export async function GET() {
  try {
    const buffer = await generateAccImportTemplate();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Template_Impor_ACC_ProTrack.xlsx"',
      },
    });
  } catch (error) {
    console.error("Template generation error:", error);
    return NextResponse.json(
      { error: "Gagal membuat template Excel." },
      { status: 500 }
    );
  }
}
