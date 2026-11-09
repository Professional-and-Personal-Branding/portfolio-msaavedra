import { ShareLinkOpens } from '../../../analytics/domain/repositories/profile-view.repository';
import { ApplicationWithRefs } from '../../domain/repositories/application.repository';
import { ApplicationOutput } from '../dto/application.output';

/** Postulación + referencias + aperturas de su enlace (si tiene) → salida del panel. */
export function toApplicationOutput(
  row: ApplicationWithRefs,
  opens: ShareLinkOpens | undefined,
): ApplicationOutput {
  const { application, profileSlug, shareLink } = row;
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    jobUrl: application.jobUrl,
    portal: application.portal,
    notes: application.notes,
    status: application.status,
    appliedAt: application.appliedAt,
    statusChangedAt: application.statusChangedAt.toISOString(),
    curatedProfileId: application.curatedProfileId,
    profileSlug,
    shareLink: shareLink
      ? {
          id: shareLink.id,
          label: shareLink.label,
          code: shareLink.code,
          revoked: shareLink.revoked,
          opens: opens?.opens ?? 0,
          firstOpenedAt: opens?.firstOpenedAt?.toISOString() ?? null,
          lastOpenedAt: opens?.lastOpenedAt?.toISOString() ?? null,
        }
      : null,
    nextStatuses: [...application.nextStatuses()],
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}
