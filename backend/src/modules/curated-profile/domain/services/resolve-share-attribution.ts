import { ShareLink } from '../entities/share-link.entity';
import { normalizeSource } from './normalize-source';

export interface ShareAttribution {
  readonly shareLinkId: string | null;
  readonly source: string | null;
}

/**
 * Reglas de atribución de una visita (decisión D7 de `add-share-links`).
 * El enlace se atribuye solo si existe, está activo y es del perfil resuelto (por id, así un
 * slug anterior también atribuye). El portal es el del enlace atribuido si lo tiene; si no, el
 * `src` normalizado; si no, nulo.
 */
export function resolveShareAttribution(input: {
  curatedProfileId: string;
  link: ShareLink | null;
  src: unknown;
}): ShareAttribution {
  const { link } = input;
  const attributed = link !== null && link.isActive() && link.belongsTo(input.curatedProfileId);
  const source = attributed && link.portal ? link.portal : normalizeSource(input.src);
  return { shareLinkId: attributed ? link.id : null, source };
}
