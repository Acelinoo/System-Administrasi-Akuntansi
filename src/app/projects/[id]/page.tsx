import { notFound } from "next/navigation";
import { getProject360Data } from "@/lib/finance/project-360.service";
import { prisma } from "@/lib/db/prisma";
import Project360Client from "./Project360Client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [data, cashAccounts, vendors, categories] = await Promise.all([
    getProject360Data(id),
    prisma.cashAccount.findMany({
      where: { isActive: true },
      select: { id: true, accountName: true, accountCode: true },
      orderBy: { accountCode: "asc" },
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <Project360Client
      data={data}
      lookups={{
        cashAccounts,
        vendors,
        categories,
      }}
    />
  );
}
