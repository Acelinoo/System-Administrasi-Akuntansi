import ExcelJS from "exceljs";
import path from "path";

function getCellString(cell: ExcelJS.Cell): string {
  try {
    const val = cell.value;
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      const obj = val as unknown as Record<string, unknown>;
      if ("richText" in obj && Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text?: string }>).map((t) => t.text || "").join("").trim();
      }
      if ("text" in obj) return String(obj.text || "").trim();
      if ("result" in obj) return String(obj.result || "").trim();
    }
    return String(val).trim();
  } catch {
    return "";
  }
}

interface VoucherAppearance {
  sheetName: string;
  rowIdx: number;
  dateBlock?: string;
  items: Array<{
    desc: string;
    pengajuan: number;
    pencairan: number;
  }>;
}

async function main() {
  const filePath = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const noKasMap = new Map<string, VoucherAppearance[]>();
  const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;

  for (let idx = 0; idx < wb.worksheets.length; idx++) {
    const ws = wb.worksheets[idx];
    const sheetName = ws.name.trim();

    // Check if recap sheet
    let isRecap = false;
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const row = ws.getRow(r);
      let rowJoined = "";
      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
        rowJoined += " " + getCellString(row.getCell(c));
      }
      if (rowJoined.toUpperCase().includes("REKAPAN PENGAJUAN") || rowJoined.toUpperCase().includes("POSISI KAS")) {
        isRecap = true;
        break;
      }
    }
    if (!isRecap) continue;

    // Detect date blocks in this sheet
    let currentDateBlock = "";
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const maxCol = Math.min(ws.columnCount, 40);

      // check if date block header
      for (let c = 1; c <= maxCol; c++) {
        const val = getCellString(row.getCell(c));
        if (val.toUpperCase().startsWith("PER TANGGAL")) {
          currentDateBlock = val;
          break;
        }
      }

      for (let c = 1; c <= maxCol; c++) {
        const cellStr = getCellString(row.getCell(c));
        if (noKasRegex.test(cellStr)) {
          const noKas = cellStr.toUpperCase();
          const desc = getCellString(row.getCell(c + 1));
          const pengajuan = parseFloat(getCellString(row.getCell(c + 2)).replace(/[^0-9.-]/g, "") || "0");
          const pencairan = parseFloat(getCellString(row.getCell(c + 3)).replace(/[^0-9.-]/g, "") || "0");

          if (!noKasMap.has(noKas)) {
            noKasMap.set(noKas, []);
          }

          const appearances = noKasMap.get(noKas)!;
          let currentApp = appearances.find((a) => a.sheetName === sheetName);
          if (!currentApp) {
            currentApp = {
              sheetName,
              rowIdx: r,
              dateBlock: currentDateBlock || undefined,
              items: [],
            };
            appearances.push(currentApp);
          }

          currentApp.items.push({
            desc,
            pengajuan: isNaN(pengajuan) ? 0 : pengajuan,
            pencairan: isNaN(pencairan) ? 0 : pencairan,
          });
        }
      }
    }
  }

  // Analyze repetitions across multiple sheets
  const repeated = Array.from(noKasMap.entries()).filter(([_, apps]) => apps.length > 1);
  console.log(`Total Unique No Kas: ${noKasMap.size}`);
  console.log(`Total No Kas appearing in > 1 sheet: ${repeated.length}`);

  let sameAmountCarriedForward = 0;
  let updatedRealization = 0;
  let differentItems = 0;

  repeated.slice(0, 15).forEach(([noKas, apps]) => {
    console.log(`\n=== No Kas: ${noKas} (Appears in ${apps.length} sheets: ${apps.map((a) => a.sheetName).join(", ")}) ===`);
    apps.forEach((a) => {
      const totalPengajuan = a.items.reduce((s, i) => s + i.pengajuan, 0);
      const totalPencairan = a.items.reduce((s, i) => s + i.pencairan, 0);
      console.log(`   [${a.sheetName} | Block: ${a.dateBlock || "none"}] Items: ${a.items.length}, Pengajuan: ${totalPengajuan}, Pencairan: ${totalPencairan}`);
      a.items.slice(0, 2).forEach((it) => console.log(`      - ${it.desc}: Pengajuan ${it.pengajuan}, Pencairan ${it.pencairan}`));
    });

    const app0 = apps[0];
    const app1 = apps[1];
    const p0 = app0.items.reduce((s, i) => s + i.pengajuan, 0);
    const p1 = app1.items.reduce((s, i) => s + i.pengajuan, 0);
    const c0 = app0.items.reduce((s, i) => s + i.pencairan, 0);
    const c1 = app1.items.reduce((s, i) => s + i.pencairan, 0);

    if (p0 === p1 && c0 === c1) {
      sameAmountCarriedForward++;
    } else if (p0 === p1 && c1 > c0) {
      updatedRealization++;
    } else {
      differentItems++;
    }
  });

  console.log("\nSnapshot category counts among sampled:");
  console.log(`- Exact same pengajuan & pencairan carried forward: ${sameAmountCarriedForward}`);
  console.log(`- Updated realization (pencairan filled in later sheet): ${updatedRealization}`);
  console.log(`- Different amounts/items: ${differentItems}`);
}

main().catch(console.error);
