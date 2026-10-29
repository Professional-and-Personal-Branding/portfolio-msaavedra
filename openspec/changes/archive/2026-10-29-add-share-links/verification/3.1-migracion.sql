-- CreateEnum
CREATE TYPE "ShareLinkKind" AS ENUM ('MANUAL', 'LINKEDIN_POST');

-- AlterTable
ALTER TABLE "ProfileView" ADD COLUMN     "shareLinkId" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "curatedProfileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "portal" TEXT,
    "kind" "ShareLinkKind" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_code_key" ON "ShareLink"("code");

-- CreateIndex
CREATE INDEX "ShareLink_curatedProfileId_idx" ON "ShareLink"("curatedProfileId");

-- CreateIndex
CREATE INDEX "ProfileView_shareLinkId_idx" ON "ProfileView"("shareLinkId");

-- CreateIndex
CREATE INDEX "ProfileView_source_idx" ON "ProfileView"("source");

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_curatedProfileId_fkey" FOREIGN KEY ("curatedProfileId") REFERENCES "CuratedProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
