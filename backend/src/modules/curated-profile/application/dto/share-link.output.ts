import { ShareLink, ShareLinkKind } from '../../domain/entities/share-link.entity';

/**
 * Enlace tal como lo ve el panel (D10 de `add-share-links`). La URL no viaja: el frontend la
 * compone con el origen del sitio y la ruta del slug vigente.
 */
export interface ShareLinkOutput {
  id: string;
  code: string;
  label: string;
  portal: string | null;
  kind: ShareLinkKind;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601 si está revocado; null si está activo. */
  revokedAt: string | null;
  /** Aperturas de personas (`HUMAN`) en toda la historia del enlace. */
  opens: number;
  /** ISO 8601 de la última apertura de una persona, o null. */
  lastOpenedAt: string | null;
}

export function toShareLinkOutput(
  link: ShareLink,
  opens: { opens: number; lastOpenedAt: Date | null } = { opens: 0, lastOpenedAt: null },
): ShareLinkOutput {
  return {
    id: link.id,
    code: link.code,
    label: link.label,
    portal: link.portal,
    kind: link.kind,
    createdAt: link.createdAt.toISOString(),
    revokedAt: link.revokedAt?.toISOString() ?? null,
    opens: opens.opens,
    lastOpenedAt: opens.lastOpenedAt?.toISOString() ?? null,
  };
}
