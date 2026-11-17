import { FeaturedRepository } from '../../domain/entities/featured-repository.entity';
import { githubRepositoryKeyOf } from '../../domain/services/parse-github-repository-url';
import {
  AdminFeaturedRepositoryOutput,
  AdminRepositoryEvidenceOutput,
} from '../dto/featured-repository.admin-output';

function toAdminEvidence(r: FeaturedRepository): AdminRepositoryEvidenceOutput | null {
  const evidence = r.evidence;
  if (!evidence) return null;
  return {
    status: evidence.status,
    repoKey: evidence.repoKey,
    stars: evidence.stars,
    primaryLanguage: evidence.primaryLanguage,
    topics: [...evidence.topics],
    archived: evidence.archived,
    movedTo: evidence.movedTo,
    githubDescription: evidence.githubDescription,
    verifiedAt: evidence.verifiedAt.toISOString(),
    changedAt: evidence.changedAt.toISOString(),
    stale: evidence.repoKey !== githubRepositoryKeyOf(r.url),
  };
}

export function toAdminFeaturedRepositoryOutput(
  r: FeaturedRepository,
): AdminFeaturedRepositoryOutput {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    language: r.language,
    description: r.description,
    technologies: [...r.technologies],
    tags: [...r.tags],
    order: r.order,
    visible: r.visible,
    evidence: toAdminEvidence(r),
  };
}
