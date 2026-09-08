import type { CuratedProfileSummary } from '@/shared/types/portfolio';

export interface ProfileGroup {
  roleType: string;
  profiles: CuratedProfileSummary[];
}

/**
 * Agrupa por `roleType` conservando el orden de aparición (spec `public-portfolio-frontend`).
 * Los perfiles sin `roleType` (el perfil completo `all`) forman un grupo con etiqueta vacía
 * que va primero; la UI le pone el nombre "Perfil completo".
 */
export function groupProfilesByRoleType(
  profiles: readonly CuratedProfileSummary[],
): ProfileGroup[] {
  const groups = new Map<string, CuratedProfileSummary[]>();
  for (const profile of profiles) {
    const key = profile.roleType.trim();
    const list = groups.get(key);
    if (list) list.push(profile);
    else groups.set(key, [profile]);
  }
  const entries = [...groups.entries()].map(([roleType, list]) => ({ roleType, profiles: list }));
  return [...entries.filter((g) => g.roleType === ''), ...entries.filter((g) => g.roleType !== '')];
}
