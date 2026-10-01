import path from "path";
import { parseAndMapRealWorkbook } from "../src/lib/finance/real-bulk-importer";

async function main() {
  const filePath = path.resolve("./Rekap Pengajuan Mingguan 2026 (2) (1) (2)(1).xlsx");
  const parsed = await parseAndMapRealWorkbook(filePath);

  let totalCandidateApproved = 0;
  let totalCandidateRealized = 0;
  let totalItems = 0;

  for (const v of parsed.uniqueVouchers) {
    for (const it of v.items) {
      totalItems++;
      totalCandidateApproved += it.approvedAmount;
      totalCandidateRealized += it.realizedAmount;
    }
  }

  console.log({
    uniqueVouchers: parsed.uniqueVouchers.length,
    totalItems,
    totalCandidateApproved,
    totalCandidateRealized,
  });
}

main().catch(console.error);
