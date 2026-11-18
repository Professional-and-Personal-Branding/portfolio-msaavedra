-- polish-pre-deploy-cleanup (D1): columna inerte desde add-github-code-evidence (P3).
-- Las stars viven en RepositoryEvidence y solo las escribe el conector de GitHub.
ALTER TABLE "FeaturedRepository" DROP COLUMN "stars";
