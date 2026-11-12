import type { JobPosting, JobPostingSuggestion } from '@/features/backoffice/shared/admin-types';

export function makeJobPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'jp-1',
    source: 'LEVER',
    sourceUrl: 'https://jobs.lever.co/acmeejemplo/abc',
    applyUrl: 'https://jobs.lever.co/acmeejemplo/abc/apply',
    title: 'Senior Platform Engineer',
    company: 'Acme Ejemplo',
    location: 'Buenos Aires, Argentina',
    workplaceType: 'HYBRID',
    employmentType: 'Full-time',
    compensation: null,
    language: 'es',
    postedAt: '2026-10-30T16:00:00.000Z',
    description: 'Buscamos un ingeniero con Java, Spring Boot, Kubernetes y Go.',
    descriptionTruncated: false,
    detectedTerms: ['java', 'spring-boot', 'kubernetes', 'go'],
    importedAt: '2026-11-12T12:00:00.000Z',
    textPurgeAt: '2027-02-10T12:00:00.000Z',
    textPurged: false,
    createdAt: '2026-11-12T12:00:00.000Z',
    updatedAt: '2026-11-12T12:00:00.000Z',
    ...overrides,
  };
}

export function makeSuggestion(
  overrides: Partial<JobPostingSuggestion> = {},
): JobPostingSuggestion {
  return {
    coverage: {
      covered: [
        { tag: 'java', evidence: 3 },
        { tag: 'spring-boot', evidence: 1 },
      ],
      uncovered: ['go', 'kubernetes'],
      detectedCount: 4,
      coveredCount: 2,
      ratio: 0.5,
    },
    suggestedFilterTags: ['java', 'spring-boot'],
    suggestedTitle: 'Senior Platform Engineer',
    suggestedSlugBase: 'acme-ejemplo-senior-platform-engineer',
    ...overrides,
  };
}
