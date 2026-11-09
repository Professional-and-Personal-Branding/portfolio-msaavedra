import { Result } from '../../../../shared/domain/result';
import { ApplicationStatus } from '../application-status';
import { Application, NewApplicationProps } from '../entities/application.entity';
import { ApplicationNotFoundError } from '../errors/application-not-found.error';
import { ShareLinkAlreadyTrackedError } from '../errors/share-link-already-tracked.error';

export const APPLICATION_REPOSITORY = Symbol('ApplicationRepository');

/** Lo que la lista muestra del enlace sin otra consulta (D8). */
export interface ApplicationShareLinkRef {
  readonly id: string;
  readonly label: string;
  readonly code: string;
  readonly revoked: boolean;
}

/** Una postulación con el `slug` del perfil y los datos del enlace, leídos en la misma consulta. */
export interface ApplicationWithRefs {
  readonly application: Application;
  readonly profileSlug: string | null;
  readonly shareLink: ApplicationShareLinkRef | null;
}

export interface ApplicationFilter {
  /** Sin valor o vacío: todas. */
  readonly statuses?: readonly ApplicationStatus[];
}

export interface ApplicationRepository {
  /** `updatedAt` descendente e `id` descendente; una sola consulta con los datos de referencia. */
  list(filter: ApplicationFilter): Promise<ApplicationWithRefs[]>;
  findById(id: string): Promise<ApplicationWithRefs | null>;
  /** El enlace repetido (único) se traduce a `ShareLinkAlreadyTrackedError`. */
  create(
    props: NewApplicationProps,
  ): Promise<Result<ApplicationWithRefs, ShareLinkAlreadyTrackedError>>;
  /** Una sola escritura con todos los campos; falla si la postulación ya no existe. */
  update(
    application: Application,
  ): Promise<Result<ApplicationWithRefs, ShareLinkAlreadyTrackedError | ApplicationNotFoundError>>;
  /** `false` si ya no existía. */
  delete(id: string): Promise<boolean>;
  /** Un `groupBy`; los estados sin filas pueden faltar. */
  countByStatus(): Promise<Partial<Record<ApplicationStatus, number>>>;
  /** ¿Otra postulación (distinta de `exceptId`) ya usa el enlace? */
  isShareLinkTracked(shareLinkId: string, exceptId?: string): Promise<boolean>;
}
