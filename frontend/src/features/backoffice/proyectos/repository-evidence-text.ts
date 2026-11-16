import { formatDate } from '@/shared/lib/format';
import type { AdminRepository, IntegrationsOverview } from '../shared/admin-types';

/**
 * Textos del estado de verificación contra GitHub en el bloque Repositorios (change
 * `add-github-code-evidence`, D12). Siempre texto: el color solo lo refuerza. Los mensajes literales
 * se repiten en `docs/MANUAL.md` (B7) y `manual:check` los verifica.
 */
export const UNVERIFIED_LABEL = 'Sin verificar';
export const UNVERIFIED_HINT =
  'Se verifica en la próxima sincronización o con «Sincronizar ahora» en Integraciones.';
export const NOT_FOUND_LABEL = 'No encontrado en GitHub';
export const INACCESSIBLE_LABEL = 'GitHub no da acceso';
export const PRIVATE_LABEL = 'Privado: no se publica';
export const GITHUB_FAILED_PREFIX = 'La última sincronización con GitHub falló';
export const GITHUB_STALE_DATA_NOTE = 'Se siguen mostrando los datos verificados por última vez.';

export type EvidenceTone = 'ok' | 'problem' | 'pending';

export interface EvidenceBadge {
  readonly text: string;
  readonly tone: EvidenceTone;
  /** Explicación breve bajo la insignia (solo «Sin verificar»). */
  readonly hint?: string;
}

/** Insignia del estado de un repositorio a partir de la evidencia cruda del panel. */
export function evidenceBadge(evidence: AdminRepository['evidence']): EvidenceBadge {
  if (!evidence || evidence.stale) {
    return { text: UNVERIFIED_LABEL, tone: 'pending', hint: UNVERIFIED_HINT };
  }
  switch (evidence.status) {
    case 'NOT_FOUND':
      return { text: NOT_FOUND_LABEL, tone: 'problem' };
    case 'INACCESSIBLE':
      return { text: INACCESSIBLE_LABEL, tone: 'problem' };
    case 'PRIVATE':
      return { text: PRIVATE_LABEL, tone: 'problem' };
    default:
      return { text: `Verificado el ${formatDate(evidence.verifiedAt, 'es')}`, tone: 'ok' };
  }
}

/** Aviso de que GitHub movió o renombró el repositorio; `null` si no hay nada que avisar. */
export function movedNotice(evidence: AdminRepository['evidence']): string | null {
  if (!evidence || evidence.stale || evidence.movedTo === null) return null;
  return `GitHub lo movió a ${evidence.movedTo}: actualizá la URL`;
}

/** El estado del proveedor `github` en Integraciones, o `undefined` si no está habilitado. */
function githubStatus(overview: IntegrationsOverview | undefined) {
  return overview?.providers.find((provider) => provider.provider === 'github');
}

/**
 * Aviso del bloque si la última sincronización falló (D12): trabajo `DEAD` en la última corrida,
 * trabajos muertos o proveedor atrasado. `null` si no hay datos, el proveedor no está habilitado o
 * todo está bien.
 */
export function githubSyncWarning(overview: IntegrationsOverview | undefined): string | null {
  const github = githubStatus(overview);
  if (!github) return null;
  if (github.lastRun?.outcome !== 'DEAD' && github.jobs.dead === 0 && !github.stale) return null;
  const detail =
    github.lastDeadError ?? github.lastRun?.errorMessage ?? 'sin sincronizar hace más de 48 h';
  return `${GITHUB_FAILED_PREFIX}: ${detail}. ${GITHUB_STALE_DATA_NOTE}`;
}
