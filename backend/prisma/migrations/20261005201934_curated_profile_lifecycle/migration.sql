-- AlterTable
ALTER TABLE "CuratedProfile" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CuratedProfileSlugAlias" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "curatedProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuratedProfileSlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuratedProfileSlugAlias_slug_key" ON "CuratedProfileSlugAlias"("slug");

-- CreateIndex
CREATE INDEX "CuratedProfileSlugAlias_curatedProfileId_idx" ON "CuratedProfileSlugAlias"("curatedProfileId");

-- AddForeignKey
ALTER TABLE "CuratedProfileSlugAlias" ADD CONSTRAINT "CuratedProfileSlugAlias_curatedProfileId_fkey" FOREIGN KEY ("curatedProfileId") REFERENCES "CuratedProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
