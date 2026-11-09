import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewRepository,
} from '../../../analytics/domain/repositories/profile-view.repository';
import {
  ACTIVE_APPLICATION_STATUSES,
  APPLICATION_STATUSES,
  ApplicationStatus,
} from '../../domain/application-status';
import { buildNewApplication, NewApplicationInput } from '../../domain/entities/application.entity';
import { ApplicationNotFoundError } from '../../domain/errors/application-not-found.error';
import { InvalidApplicationTransitionError } from '../../domain/errors/invalid-application-transition.error';
import { ShareLinkAlreadyTrackedError } from '../../domain/errors/share-link-already-tracked.error';
import {
  APPLICATION_REFERENCE_READER,
  ApplicationReferenceReader,
} from '../../domain/repositories/application-reference.reader';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../domain/repositories/application.repository';
import { validateApplicationFields } from '../../domain/services/validate-application-fields';
import { ApplicationOutput, ApplicationSummaryOutput } from '../dto/application.output';
import { buildApplicationOutputs } from '../services/build-application-outputs';
import { applicationCsvFilename, toApplicationCsv } from '../services/to-application-csv';
import { validateApplicationLinks } from '../services/validate-application-links';

export interface ListApplicationsInput {
  /** Sin valor o vacío: todas. */
  statuses?: readonly ApplicationStatus[];
}

/** Cambios parciales de una postulación: `undefined` = no cambia; `null` = vaciar lo opcional. */
export interface UpdateApplicationInput {
  id: string;
  company?: string;
  role?: string;
  jobUrl?: string | null;
  portal?: string | null;
  notes?: string | null;
  status?: ApplicationStatus;
  appliedAt?: string | null;
  curatedProfileId?: string | null;
  shareLinkId?: string | null;
}

/** Lista (más recientemente editadas primero) con las aperturas de los enlaces en dos consultas. */
@Injectable()
export class ListApplicationsUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository,
  ) {}

  async execute(input: ListApplicationsInput): Promise<ApplicationOutput[]> {
    const rows = await this.applications.list({ statuses: input.statuses });
    return buildApplicationOutputs(this.views, rows);
  }
}

@Injectable()
export class GetApplicationUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<ApplicationOutput, ApplicationNotFoundError>> {
    const row = await this.applications.findById(input.id);
    if (!row) return fail(new ApplicationNotFoundError(input.id));
    const [output] = await buildApplicationOutputs(this.views, [row]);
    return ok(output);
  }
}

/** Alta en cualquier estado; valida campos, fechas y vínculos antes de escribir (D2, D4, D7). */
@Injectable()
export class CreateApplicationUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(APPLICATION_REFERENCE_READER) private readonly references: ApplicationReferenceReader,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    input: NewApplicationInput,
  ): Promise<Result<ApplicationOutput, ValidationError | ShareLinkAlreadyTrackedError>> {
    const props = buildNewApplication(input, this.clock.now());
    if (!props.ok) return props;
    const links = await validateApplicationLinks(
      this.references,
      props.value.curatedProfileId,
      props.value.shareLinkId,
    );
    if (!links.ok) return links;
    const shareLinkId = props.value.shareLinkId;
    if (shareLinkId !== null && (await this.applications.isShareLinkTracked(shareLinkId))) {
      return fail(new ShareLinkAlreadyTrackedError());
    }
    const created = await this.applications.create(props.value);
    if (!created.ok) return created;
    const [output] = await buildApplicationOutputs(this.views, [created.value]);
    return ok(output);
  }
}

/**
 * Edición parcial en una sola escritura (D9): se arma la postulación nueva en memoria (campos,
 * estado, fecha, vínculos) y, si algo falla —incluida una transición inválida—, no se escribe nada.
 */
@Injectable()
export class UpdateApplicationUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(APPLICATION_REFERENCE_READER) private readonly references: ApplicationReferenceReader,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    input: UpdateApplicationInput,
  ): Promise<
    Result<
      ApplicationOutput,
      | ApplicationNotFoundError
      | ValidationError
      | InvalidApplicationTransitionError
      | ShareLinkAlreadyTrackedError
    >
  > {
    const existing = await this.applications.findById(input.id);
    if (!existing) return fail(new ApplicationNotFoundError(input.id));
    const now = this.clock.now();
    let application = existing.application;

    const fields = validateApplicationFields({
      company: input.company ?? application.company,
      role: input.role ?? application.role,
      jobUrl: input.jobUrl === undefined ? application.jobUrl : input.jobUrl,
      portal: input.portal === undefined ? application.portal : input.portal,
      notes: input.notes === undefined ? application.notes : input.notes,
    });
    if (!fields.ok) return fields;
    application = application.withFields(fields.value);

    if (input.status !== undefined) {
      const moved = application.transitionTo(input.status, now);
      if (!moved.ok) return moved;
      application = moved.value;
    }
    if (input.appliedAt !== undefined) {
      const dated = application.withAppliedAt(input.appliedAt, now);
      if (!dated.ok) return dated;
      application = dated.value;
    }

    const linksChanged = input.curatedProfileId !== undefined || input.shareLinkId !== undefined;
    if (linksChanged) {
      const curatedProfileId =
        input.curatedProfileId === undefined
          ? application.curatedProfileId
          : input.curatedProfileId;
      const shareLinkId =
        input.shareLinkId === undefined ? application.shareLinkId : input.shareLinkId;
      const links = await validateApplicationLinks(this.references, curatedProfileId, shareLinkId);
      if (!links.ok) return links;
      if (
        shareLinkId !== null &&
        shareLinkId !== existing.application.shareLinkId &&
        (await this.applications.isShareLinkTracked(shareLinkId, application.id))
      ) {
        return fail(new ShareLinkAlreadyTrackedError());
      }
      application = application.withLinks({ curatedProfileId, shareLinkId });
    }

    const saved = await this.applications.update(application);
    if (!saved.ok) return saved;
    const [output] = await buildApplicationOutputs(this.views, [saved.value]);
    return ok(output);
  }
}

@Injectable()
export class DeleteApplicationUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
  ) {}

  async execute(input: { id: string }): Promise<Result<void, ApplicationNotFoundError>> {
    return (await this.applications.delete(input.id))
      ? ok(undefined)
      : fail(new ApplicationNotFoundError(input.id));
  }
}

/** Los siete estados con ceros y `active` (DRAFT + APPLIED + INTERVIEWING + OFFER). */
@Injectable()
export class GetApplicationSummaryUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
  ) {}

  async execute(): Promise<ApplicationSummaryOutput> {
    const counts = await this.applications.countByStatus();
    const byStatus = Object.fromEntries(
      APPLICATION_STATUSES.map((status) => [status, counts[status] ?? 0]),
    ) as Record<ApplicationStatus, number>;
    const active = ACTIVE_APPLICATION_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
    return { byStatus, active };
  }
}

/** CSV con el mismo filtro y orden que la lista y el nombre con la fecha UTC del reloj (D10). */
@Injectable()
export class ExportApplicationsUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: ListApplicationsInput): Promise<{ filename: string; csv: string }> {
    const rows = await this.applications.list({ statuses: input.statuses });
    const outputs = await buildApplicationOutputs(this.views, rows);
    return { filename: applicationCsvFilename(this.clock.now()), csv: toApplicationCsv(outputs) };
  }
}
