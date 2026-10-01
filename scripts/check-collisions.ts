import { prisma } from '../src/lib/db/prisma';
import ExcelJS from 'exceljs';
import path from 'path';

function getCellString(cell: ExcelJS.Cell): string {
  try {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      const obj = val as unknown as Record<string, unknown>;
      if ('richText' in obj && Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text?: string }>).map((t) => t.text || '').join('').trim();
      }
      if ('text' in obj) return String(obj.text || '').trim();
      if ('result' in obj) return String(obj.result || '').trim();
    }
    return String(val).trim();
  } catch {
    return '';
  }
}

async function main() {
  const existingBatches = await prisma.submissionBatch.findMany({
    select: { id: true, batchCode: true, noKas: true, items: { select: { noKas: true } } }
  });

  const existingNoKasSet = new Set<string>();
  existingBatches.forEach(b => {
    if (b.noKas) existingNoKasSet.add(b.noKas.toUpperCase());
    b.items.forEach(i => {
      if (i.noKas) existingNoKasSet.add(i.noKas.toUpperCase());
    });
  });

  console.log(`Existing DB has ${existingNoKasSet.size} unique No Kas.`);
  console.log(`Sample DB No Kas:`, Array.from(existingNoKasSet).slice(0, 10));

  const filePath = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const noKasRegex = /^[Kk][UuTtNn]\.[0-9]{2}\.[0-9]{3,}$/;
  const collidingNoKas = new Set<string>();
  const excelUniqueNoKas = new Set<string>();

  for (let idx = 0; idx < wb.worksheets.length; idx++) {
    const ws = wb.worksheets[idx];
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

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cellStr = getCellString(row.getCell(2)); // Col B
      if (noKasRegex.test(cellStr)) {
        const upper = cellStr.toUpperCase();
        excelUniqueNoKas.add(upper);
        if (existingNoKasSet.has(upper)) {
          collidingNoKas.add(upper);
        }
      }
    }
  }

  console.log(`Excel has ${excelUniqueNoKas.size} unique No Kas in Col B.`);
  console.log(`Colliding No Kas with existing DB records: ${collidingNoKas.size}`);
  if (collidingNoKas.size > 0) {
    console.log(`Colliding codes:`, Array.from(collidingNoKas));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
