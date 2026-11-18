-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('RESERVED', 'SUCCEEDED', 'CACHED', 'REFUSED', 'FAILED', 'ABANDONED', 'BLOCKED');

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "status" "AiRunStatus" NOT NULL,
    "reservedMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "cacheWriteTokens" INTEGER,
    "stopReason" TEXT,
    "failureKind" TEXT,
    "failureMessage" TEXT,
    "output" JSONB,
    "requestId" TEXT,
    "durationMs" INTEGER,
    "budgetMonth" TEXT NOT NULL,
    "reservationExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBudgetMonth" (
    "month" TEXT NOT NULL,
    "spentMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "reservedMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "providerBlockedUntil" TIMESTAMP(3),
    "providerBlockReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBudgetMonth_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE INDEX "AiRun_cacheKey_status_idx" ON "AiRun"("cacheKey", "status");

-- CreateIndex
CREATE INDEX "AiRun_budgetMonth_status_idx" ON "AiRun"("budgetMonth", "status");

-- CreateIndex
CREATE INDEX "AiRun_createdAt_idx" ON "AiRun"("createdAt");
