import type {
  Application,
  ApplicationStatus,
  ApplicationSummary,
} from '@/features/backoffice/shared/admin-types';

/** Transiciones válidas (D4): el servidor las manda en `nextStatuses`; el fixture las repite. */
const NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['APPLIED', 'WITHDRAWN'],
  APPLIED: ['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  INTERVIEWING: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: ['APPLIED'],
  WITHDRAWN: ['APPLIED'],
};

export function makeApplication(overrides: Partial<Application> = {}): Application {
  const status = overrides.status ?? 'APPLIED';
  return {
    id: 'app-1',
    company: 'Globex',
    role: 'Backend Senior',
    jobUrl: null,
    portal: null,
    notes: null,
    status,
    appliedAt: status === 'DRAFT' ? null : '2026-11-05',
    statusChangedAt: '2026-11-05T10:00:00.000Z',
    curatedProfileId: null,
    profileSlug: null,
    shareLink: null,
    nextStatuses: NEXT[status],
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:00:00.000Z',
    ...overrides,
  };
}

export function makeSummary(
  byStatus: Partial<Record<ApplicationStatus, number>> = {},
): ApplicationSummary {
  const full: Record<ApplicationStatus, number> = {
    DRAFT: 0,
    APPLIED: 0,
    INTERVIEWING: 0,
    OFFER: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
    ...byStatus,
  };
  const active = full.DRAFT + full.APPLIED + full.INTERVIEWING + full.OFFER;
  return { byStatus: full, active };
}

export const EMPTY_APPLICATION_SUMMARY = makeSummary();
