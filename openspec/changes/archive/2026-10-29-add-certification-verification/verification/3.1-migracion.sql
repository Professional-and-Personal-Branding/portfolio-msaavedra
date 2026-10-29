-- backend/prisma/migrations/20261029224637_add_certification_credential/migration.sql
-- Generada con prisma migrate dev --create-only contra portfolio_cert_check (descartable).
-- Solo ADD COLUMN: sin UPDATE ni DROP (D10).
-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "credentialId" TEXT,
ADD COLUMN     "expiresAt" TEXT,
ADD COLUMN     "verificationUrl" TEXT;

-- prisma migrate deploy sobre portfolio_cert_check: OK.
-- prisma migrate diff --from-url portfolio_cert_check --to-schema-datamodel prisma/schema.prisma --exit-code: No difference detected (exit 0).
