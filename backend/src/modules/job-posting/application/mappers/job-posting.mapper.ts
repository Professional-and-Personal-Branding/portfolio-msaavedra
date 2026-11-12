import { JobPosting } from '../../domain/entities/job-posting.entity';
import { JobPostingOutput } from '../dto/job-posting.output';

export function toJobPostingOutput(posting: JobPosting): JobPostingOutput {
  return {
    id: posting.id,
    source: posting.source,
    sourceUrl: posting.sourceUrl,
    applyUrl: posting.applyUrl,
    title: posting.title,
    company: posting.company,
    location: posting.location,
    workplaceType: posting.workplaceType,
    employmentType: posting.employmentType,
    compensation: posting.compensation,
    language: posting.language,
    postedAt: posting.postedAt?.toISOString() ?? null,
    description: posting.description,
    descriptionTruncated: posting.descriptionTruncated,
    detectedTerms: [...posting.detectedTerms],
    importedAt: posting.importedAt.toISOString(),
    textPurgeAt: posting.textPurgeAt.toISOString(),
    textPurged: posting.description === null,
    createdAt: posting.createdAt.toISOString(),
    updatedAt: posting.updatedAt.toISOString(),
  };
}
