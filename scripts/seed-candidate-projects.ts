import { prisma } from '../src/lib/db/prisma';

async function main() {
  console.log("Upserting candidate project master records...");

  const candidateProjects = [
    { code: "DARUL_ULUM", name: "Proyek Darul Ulum", description: "Pekerjaan Proyek Darul Ulum" },
    { code: "BUDI_INDAH", name: "Proyek Budi Indah", description: "Pekerjaan Proyek Budi Indah" },
    { code: "APARTEMEN", name: "Proyek Apartemen", description: "Pekerjaan Proyek Apartemen" },
    { code: "ANTAPANI", name: "Proyek Antapani", description: "Pekerjaan Proyek Antapani" },
    { code: "CIREBON", name: "Proyek Cirebon", description: "Pekerjaan Proyek Cirebon" },
    { code: "JL_GITAR", name: "Proyek Jl. Gitar", description: "Pekerjaan Proyek Jl. Gitar" },
  ];

  for (const p of candidateProjects) {
    const proj = await prisma.project.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description },
      create: { code: p.code, name: p.name, description: p.description, isActive: true },
    });
    console.log(`- Project upserted: ${proj.code} (${proj.name})`);
  }

  // Add SUMEDANG sub-units: SMA, SMP, SD, TK
  const sumedang = await prisma.project.findUnique({ where: { code: "SUMEDANG" } });
  if (sumedang) {
    const sumedangSubUnits = [
      { code: "SMA", name: "Sumedang SMA" },
      { code: "SMP", name: "Sumedang SMP" },
      { code: "SD", name: "Sumedang SD" },
      { code: "TK", name: "Sumedang TK" },
    ];
    for (const sub of sumedangSubUnits) {
      await prisma.projectSubUnit.upsert({
        where: { projectId_code: { projectId: sumedang.id, code: sub.code } },
        update: { name: sub.name },
        create: { projectId: sumedang.id, code: sub.code, name: sub.name, isActive: true },
      });
      console.log(`- Sumedang SubUnit upserted: ${sub.code} (${sub.name})`);
    }
  }

  console.log("Candidate projects & sub-units setup complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
