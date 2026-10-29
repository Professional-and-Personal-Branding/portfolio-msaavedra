-- CreateEnum
CREATE TYPE "ViewKind" AS ENUM ('HUMAN', 'OWNER', 'BOT');

-- AlterTable
ALTER TABLE "ProfileView" ADD COLUMN     "kind" "ViewKind" NOT NULL DEFAULT 'HUMAN';
