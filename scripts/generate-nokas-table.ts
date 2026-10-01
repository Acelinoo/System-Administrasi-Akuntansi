import fs from "fs";

// Load 19 No Kas details from audit-detailed-output.json
const detailed = JSON.parse(fs.readFileSync("audit-detailed-output.json", "utf8"));
const in19 = detailed.inOtherColsOnly;

const table = in19.map((item: any) => ({
  sourceNoKas: item.noKas,
  normalizedNoKas: item.noKas.toUpperCase(),
  status: "EXCLUDED_FROM_SUBMISSION (RIGHT_SIDE_PAYMENT_REF)",
  alasan: `Muncul hanya pada kolom pencairan/kas posisi kanan (${item.locations.join(", ")}), bukan pada Kolom B (tabel pengajuan ACC). Dipisahkan untuk mencegah duplikasi batch.`
}));

// Add the 15 collisions
const collisions = [
  "KT.26.001", "KT.26.003", "KT.26.005", "KT.26.007", "KT.26.009",
  "KT.26.011", "KT.26.015", "KT.26.016", "KT.26.018", "KT.26.021",
  "KT.26.024", "KT.26.027", "KT.26.030", "KT.26.031", "KT.26.033"
];

collisions.forEach(c => {
  table.push({
    sourceNoKas: c,
    normalizedNoKas: c.toUpperCase(),
    status: "ALREADY_EXISTING_DB_COLLISION",
    alasan: "Voucher valid dari Excel yang sudah terinput di database melalui pengujian Phase 8B / sample import; dipertahankan tanpa duplikasi."
  });
});

console.log(`Generated ${table.length} rows for No Kas reconciliation table.`);
fs.writeFileSync("reconciliation-nokas-table.json", JSON.stringify(table, null, 2));
