-- CreateEnum
CREATE TYPE "JobPostingSourceKind" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'JSON_LD', 'PASTED');

-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "source" "JobPostingSourceKind" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "applyUrl" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "workplaceType" "WorkplaceType",
    "employmentType" TEXT,
    "compensation" TEXT,
    "language" TEXT,
    "postedAt" TIMESTAMP(3),
    "description" TEXT,
    "descriptionTruncated" BOOLEAN NOT NULL DEFAULT false,
    "detectedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importedAt" TIMESTAMP(3) NOT NULL,
    "textPurgeAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_sourceKey_key" ON "JobPosting"("sourceKey");

-- CreateIndex
CREATE INDEX "JobPosting_importedAt_idx" ON "JobPosting"("importedAt");

-- CreateIndex
CREATE INDEX "JobPosting_textPurgeAt_idx" ON "JobPosting"("textPurgeAt");
