import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { APPLICATION_TRANSITIONS, ApplicationStatus } from '../application-status';
import { InvalidApplicationTransitionError } from '../errors/invalid-application-transition.error';
import { utcDay, validateAppliedAt } from '../services/applied-at';
import {
  ApplicationFields,
  ApplicationFieldsInput,
  validateApplicationFields,
} from '../services/validate-application-fields';

export interface ApplicationProps extends ApplicationFields {
  readonly id: string;
  readonly status: ApplicationStatus;
  /** `AAAA-MM-DD`; nula solo en `DRAFT`. */
  readonly appliedAt: string | null;
  readonly statusChangedAt: Date;
  readonly curatedProfileId: string | null;
  readonly shareLinkId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Datos validados de una postulación nueva (sin `id` ni sellos de Prisma). */
export interface NewApplicationProps extends ApplicationFields {
  readonly status: ApplicationStatus;
  readonly appliedAt: string | null;
  readonly statusChangedAt: Date;
  readonly curatedProfileId: string | null;
  readonly shareLinkId: string | null;
}

export interface NewApplicationInput extends ApplicationFieldsInput {
  readonly status?: ApplicationStatus;
  readonly appliedAt?: string | null;
  readonly curatedProfileId?: string | null;
  readonly shareLinkId?: string | null;
}

const DRAFT_WITH_DATE = 'Una postulación «Por postular» no tiene fecha de postulación';

/**
 * Valida una postulación nueva (D2, D4). Se puede crear en cualquier estado; con `DRAFT` la fecha
 * tiene que ser nula y en los demás, si falta, es el día UTC del reloj. El estado inicial por
 * omisión es `DRAFT`. Los vínculos con perfil y enlace los verifica el caso de uso.
 */
export function buildNewApplication(
  input: NewApplicationInput,
  now: Date,
): Result<NewApplicationProps, ValidationError> {
  const fields = validateApplicationFields(input);
  if (!fields.ok) return fields;
  const status = input.status ?? 'DRAFT';
  let appliedAt: string | null;
  if (status === 'DRAFT') {
    if (input.appliedAt !== undefined && input.appliedAt !== null) {
      return fail(new ValidationError(DRAFT_WITH_DATE, ['appliedAt']));
    }
    appliedAt = null;
  } else if (input.appliedAt === undefined || input.appliedAt === null) {
    appliedAt = utcDay(now);
  } else {
    const day = validateAppliedAt(input.appliedAt, now);
    if (!day.ok) return day;
    appliedAt = day.value;
  }
  return ok({
    ...fields.value,
    status,
    appliedAt,
    statusChangedAt: now,
    curatedProfileId: input.curatedProfileId ?? null,
    shareLinkId: input.shareLinkId ?? null,
  });
}

/**
 * Postulación a una vacante. Inmutable: cada cambio devuelve otra instancia, así un caso de uso
 * puede encadenar varios y escribir una sola vez (D9: el PATCH es atómico). Sin decoradores ni
 * Prisma.
 */
export class Application {
  constructor(private readonly props: ApplicationProps) {}

  get id(): string {
    return this.props.id;
  }
  get company(): string {
    return this.props.company;
  }
  get role(): string {
    return this.props.role;
  }
  get jobUrl(): string | null {
    return this.props.jobUrl;
  }
  get portal(): string | null {
    return this.props.portal;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get status(): ApplicationStatus {
    return this.props.status;
  }
  get appliedAt(): string | null {
    return this.props.appliedAt;
  }
  get statusChangedAt(): Date {
    return this.props.statusChangedAt;
  }
  get curatedProfileId(): string | null {
    return this.props.curatedProfileId;
  }
  get shareLinkId(): string | null {
    return this.props.shareLinkId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Estados a los que puede pasar desde el actual. */
  nextStatuses(): readonly ApplicationStatus[] {
    return APPLICATION_TRANSITIONS[this.props.status];
  }

  /**
   * Cambia de estado. El mismo estado es un no-op (conserva `statusChangedAt`). Al salir de
   * `DRAFT` sin fecha, la postulación se fecha con el día UTC del reloj; reabrir no la toca.
   */
  transitionTo(
    next: ApplicationStatus,
    now: Date,
  ): Result<Application, InvalidApplicationTransitionError> {
    if (next === this.props.status) return ok(this);
    if (!this.nextStatuses().includes(next)) {
      return fail(new InvalidApplicationTransitionError(this.props.status, next));
    }
    const leavesDraft = this.props.status === 'DRAFT' && this.props.appliedAt === null;
    return ok(
      new Application({
        ...this.props,
        status: next,
        statusChangedAt: now,
        appliedAt: leavesDraft ? utcDay(now) : this.props.appliedAt,
      }),
    );
  }

  /** Reemplaza los campos de texto ya validados. */
  withFields(fields: ApplicationFields): Application {
    return new Application({ ...this.props, ...fields });
  }

  /** Fecha explícita; con `DRAFT` solo se admite nula, y fuera de `DRAFT` no puede ser nula (D4). */
  withAppliedAt(raw: string | null, now: Date): Result<Application, ValidationError> {
    if (this.props.status === 'DRAFT') {
      if (raw === null) return ok(this);
      return fail(new ValidationError(DRAFT_WITH_DATE, ['appliedAt']));
    }
    if (raw === null) {
      return fail(
        new ValidationError('La fecha de postulación es obligatoria fuera de «Por postular»', [
          'appliedAt',
        ]),
      );
    }
    const day = validateAppliedAt(raw, now);
    if (!day.ok) return day;
    return ok(new Application({ ...this.props, appliedAt: day.value }));
  }

  /** Reemplaza el vínculo (la coherencia con el perfil la verifica el caso de uso). */
  withLinks(links: { curatedProfileId: string | null; shareLinkId: string | null }): Application {
    return new Application({ ...this.props, ...links });
  }
}
