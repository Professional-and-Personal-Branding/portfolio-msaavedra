-- CreateEnum
CREATE TYPE "RepositoryEvidenceStatus" AS ENUM ('OK', 'NOT_FOUND', 'INACCESSIBLE', 'PRIVATE');

-- CreateTable
CREATE TABLE "RepositoryEvidence" (
    "featuredRepositoryId" TEXT NOT NULL,
    "repoKey" TEXT NOT NULL,
    "status" "RepositoryEvidenceStatus" NOT NULL,
    "stars" INTEGER,
    "primaryLanguage" TEXT,
    "languages" JSONB,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pushedAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "movedTo" TEXT,
    "githubDescription" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryEvidence_pkey" PRIMARY KEY ("featuredRepositoryId")
);

-- AddForeignKey
ALTER TABLE "RepositoryEvidence" ADD CONSTRAINT "RepositoryEvidence_featuredRepositoryId_fkey" FOREIGN KEY ("featuredRepositoryId") REFERENCES "FeaturedRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
