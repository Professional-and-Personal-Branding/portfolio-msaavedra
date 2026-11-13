-- CreateEnum
CREATE TYPE "IntegrationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "SyncRunOutcome" AS ENUM ('SUCCESS', 'FAILED', 'DEAD', 'INTERRUPTED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "IntegrationSetting" (
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pausedUntil" TIMESTAMP(3),
    "pauseReason" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "enabledSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "provider" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "IntegrationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastErrorClass" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outcome" "SyncRunOutcome",
    "errorClass" TEXT,
    "errorMessage" TEXT,
    "itemsChanged" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSnapshot" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "etag" TEXT,
    "contentHash" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRunnerLease" (
    "id" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationRunnerLease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationJob_idempotencyKey_key" ON "IntegrationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "IntegrationJob_status_runAt_idx" ON "IntegrationJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "IntegrationJob_provider_status_idx" ON "IntegrationJob"("provider", "status");

-- CreateIndex
CREATE INDEX "SyncRun_provider_startedAt_idx" ON "SyncRun"("provider", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "SyncRun_jobId_idx" ON "SyncRun"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSnapshot_provider_resourceKey_key" ON "ExternalSnapshot"("provider", "resourceKey");

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntegrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un solo trabajo activo por proveedor y tipo (revisión de seguridad M4): garantiza, sin carreras, que el
-- planificador y «Sincronizar ahora» no dejen dos trabajos activos. Prisma no modela índices parciales: vive
-- solo aquí (y `migrate diff` lo ignora).
CREATE UNIQUE INDEX "IntegrationJob_one_active_per_provider_kind"
  ON "IntegrationJob"("provider", "kind")
  WHERE "status" IN ('PENDING', 'RUNNING', 'FAILED');

-- Fila única del arriendo del ejecutor (D4), con `expiresAt` en el pasado: nadie lo tiene.
INSERT INTO "IntegrationRunnerLease" ("id", "holder", "expiresAt")
VALUES ('runner', '', TIMESTAMP '1970-01-01 00:00:00');
