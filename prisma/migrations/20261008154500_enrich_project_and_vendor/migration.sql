-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('SUPPLIER', 'SUBCONTRACTOR', 'SERVICE');

-- AlterTable
ALTER TABLE "fund_inflows" ADD COLUMN "projectId" UUID;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "clientName" VARCHAR(150),
ADD COLUMN "contractValue" DECIMAL(15,2),
ADD COLUMN "targetEndDate" DATE,
ADD COLUMN "targetStartDate" DATE;

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30),
    "name" VARCHAR(150) NOT NULL,
    "type" "VendorType" NOT NULL DEFAULT 'SUPPLIER',
    "phone" VARCHAR(30),
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_code_key" ON "vendors"("code");

-- CreateIndex
CREATE INDEX "fund_inflows_projectId_idx" ON "fund_inflows"("projectId");

-- AddForeignKey
ALTER TABLE "fund_inflows" ADD CONSTRAINT "fund_inflows_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
