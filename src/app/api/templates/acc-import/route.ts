import { NextResponse } from "next/server";
import { generateAccImportTemplate } from "@/lib/finance/import.service";
import { getCurrentUser } from "@/lib/auth/auth.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid atau telah berakhir. Harap login kembali." }, { status: 401 });
  }

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
