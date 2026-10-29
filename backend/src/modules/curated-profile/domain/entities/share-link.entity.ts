import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { normalizeSource } from '../services/normalize-source';

export const SHARE_LINK_KINDS = ['MANUAL', 'LINKEDIN_POST'] as const;
export type ShareLinkKind = (typeof SHARE_LINK_KINDS)[number];

export const SHARE_LINK_LABEL_MAX = 80;

export interface ShareLinkProps {
  readonly id: string;
  readonly code: string;
  readonly curatedProfileId: string;
  readonly label: string;
  readonly portal: string | null;
  readonly kind: ShareLinkKind;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

/** Datos para crear un enlace, ya validados (el código lo pone el generador). */
export interface NewShareLinkProps {
  readonly code: string;
  readonly curatedProfileId: string;
  readonly label: string;
  readonly portal: string | null;
  readonly kind: ShareLinkKind;
}

/** Etiqueta recortada de 1 a 80 caracteres, o el error de validación. */
export function validateShareLinkLabel(raw: string): Result<string, ValidationError> {
  const label = raw.trim();
  if (label.length === 0 || label.length > SHARE_LINK_LABEL_MAX) {
    return fail(
      new ValidationError(`La etiqueta debe tener de 1 a ${SHARE_LINK_LABEL_MAX} caracteres`, [
        'label',
      ]),
    );
  }
  return ok(label);
}

/**
 * Etiqueta y portal de un enlace nuevo. A diferencia de `?src=` (que descarta lo inválido), un
 * portal mal escrito por el owner es un error: no se guarda un enlace que no atribuiría.
 */
export function validateNewShareLink(input: {
  label: string;
  portal?: string | null;
}): Result<{ label: string; portal: string | null }, ValidationError> {
  const label = validateShareLinkLabel(input.label);
  if (!label.ok) return label;
  const rawPortal = input.portal?.trim();
  if (rawPortal === undefined || rawPortal === '') return ok({ label: label.value, portal: null });
  const portal = normalizeSource(rawPortal);
  if (portal === null) {
    return fail(
      new ValidationError(
        'El portal admite letras, números y guiones (hasta 32 caracteres) y no puede empezar con guion',
        ['portal'],
      ),
    );
  }
  return ok({ label: label.value, portal });
}

/**
 * Enlace de seguimiento (decisión D1 de `add-share-links`). Inmutable: el código, el portal, el
 * tipo y el perfil no cambian nunca; la etiqueta se renombra y la revocación es irreversible e
 * idempotente. Sin decoradores ni Prisma.
 */
export class ShareLink {
  constructor(private readonly props: ShareLinkProps) {}

  get id(): string {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get curatedProfileId(): string {
    return this.props.curatedProfileId;
  }
  get label(): string {
    return this.props.label;
  }
  get portal(): string | null {
    return this.props.portal;
  }
  get kind(): ShareLinkKind {
    return this.props.kind;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  /** Activo = no revocado. Un enlace revocado deja de atribuir pero el link sigue abriendo. */
  isActive(): boolean {
    return this.props.revokedAt === null;
  }

  belongsTo(curatedProfileId: string): boolean {
    return this.props.curatedProfileId === curatedProfileId;
  }

  rename(label: string): Result<ShareLink, ValidationError> {
    const valid = validateShareLinkLabel(label);
    if (!valid.ok) return valid;
    return ok(new ShareLink({ ...this.props, label: valid.value }));
  }

  /** Revocar uno ya revocado conserva la fecha original. */
  revoke(now: Date): ShareLink {
    if (!this.isActive()) return this;
    return new ShareLink({ ...this.props, revokedAt: now });
  }
}
