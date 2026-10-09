-- Migration: 20261009160000_expand_business_models
-- Safe additive migration for ProTrack Phase 2 Business Expansion

-- 1. CreateEnum TerminStatus
CREATE TYPE "TerminStatus" AS ENUM ('PLANNED', 'INVOICED', 'RECEIVED');

-- 2. AlterTable projects
ALTER TABLE "projects" ADD COLUMN "projectType" VARCHAR(50) DEFAULT 'KONTRAKTOR';

-- 3. CreateTable project_budgets (RAP / RAB)
CREATE TABLE "project_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "totalBudget" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "dataScope" "DataScope" NOT NULL DEFAULT 'REAL',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_budgets_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable budget_items
CREATE TABLE "budget_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "budgetId" UUID NOT NULL,
    "itemCode" VARCHAR(50),
    "description" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "volume" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "unit" VARCHAR(30) NOT NULL DEFAULT 'ls',
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable project_termins
CREATE TABLE "project_termins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "terminNumber" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(100) NOT NULL,
    "plannedAmount" DECIMAL(15,2) NOT NULL,
    "invoiceNumber" VARCHAR(100),
    "invoiceDate" DATE,
    "status" "TerminStatus" NOT NULL DEFAULT 'PLANNED',
    "fundInflowId" UUID,
    "receivedAmount" DECIMAL(15,2),
    "receivedDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_termins_pkey" PRIMARY KEY ("id")
);

-- 6. CreateTable project_progress_logs
CREATE TABLE "project_progress_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "logDate" DATE NOT NULL,
    "physicalProgressPct" DECIMAL(5,2) NOT NULL,
    "volumeDescription" TEXT,
    "sourceInfo" VARCHAR(150),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_progress_logs_pkey" PRIMARY KEY ("id")
);

-- 7. CreateTable expense_item_details
CREATE TABLE "expense_item_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accItemId" UUID,
    "disbursementItemId" UUID,
    "itemName" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "unit" VARCHAR(50) NOT NULL DEFAULT 'bh',
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "totalPrice" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "vendorId" UUID,
    "referenceNo" VARCHAR(100),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_item_details_pkey" PRIMARY KEY ("id")
);

-- 8. CreateTable vendor_contracts
CREATE TABLE "vendor_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendorId" UUID NOT NULL,
    "projectId" UUID,
    "contractNumber" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "contractValue" DECIMAL(15,2) NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_contracts_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "project_budgets_projectId_idx" ON "project_budgets"("projectId");
CREATE INDEX "budget_items_budgetId_idx" ON "budget_items"("budgetId");
CREATE INDEX "project_termins_projectId_idx" ON "project_termins"("projectId");
CREATE INDEX "project_termins_fundInflowId_idx" ON "project_termins"("fundInflowId");
CREATE INDEX "project_progress_logs_projectId_idx" ON "project_progress_logs"("projectId");
CREATE INDEX "project_progress_logs_logDate_idx" ON "project_progress_logs"("logDate");
CREATE INDEX "expense_item_details_accItemId_idx" ON "expense_item_details"("accItemId");
CREATE INDEX "expense_item_details_disbursementItemId_idx" ON "expense_item_details"("disbursementItemId");
CREATE INDEX "expense_item_details_vendorId_idx" ON "expense_item_details"("vendorId");
CREATE INDEX "vendor_contracts_vendorId_idx" ON "vendor_contracts"("vendorId");
CREATE INDEX "vendor_contracts_projectId_idx" ON "vendor_contracts"("projectId");

-- Foreign Keys
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "project_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_termins" ADD CONSTRAINT "project_termins_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_termins" ADD CONSTRAINT "project_termins_fundInflowId_fkey" FOREIGN KEY ("fundInflowId") REFERENCES "fund_inflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_progress_logs" ADD CONSTRAINT "project_progress_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_item_details" ADD CONSTRAINT "expense_item_details_accItemId_fkey" FOREIGN KEY ("accItemId") REFERENCES "acc_expense_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_item_details" ADD CONSTRAINT "expense_item_details_disbursementItemId_fkey" FOREIGN KEY ("disbursementItemId") REFERENCES "disbursement_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_item_details" ADD CONSTRAINT "expense_item_details_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
