import { startTransition, useEffect, useMemo, useState } from 'react';
import type { SectionId } from '@/themes/layouts/sections';

export interface StagedSections {
  /** Las secciones que se renderizan ahora: solo `hero` hasta el revelado, todas después. */
  sections: readonly SectionId[] | null;
  /** Hay perfil pero el resto de las secciones todavía no se revelaron (hay que reservar el alto). */
  pending: boolean;
  /** El resto de las secciones ya se pidió renderizar; no vuelve atrás mientras la vista siga montada. */
  revealed: boolean;
}

/**
 * Revelado en dos tiempos del perfil (D1 de `improve-mobile-performance`): con el primer perfil del
 * montaje renderiza solo `hero`; en un efecto, dentro de `startTransition`, pasa al resto. El
 * render grande queda interrumpible y el hero (LCP) no espera al de las demás secciones.
 *
 * Una vez revelada, la vista no vuelve atrás: cambiar de idioma, de tema o de perfil dentro de la
 * misma ruta (`/:slug` conserva el componente) renderiza todas las secciones de una. `sections`
 * es `null` mientras no hay perfil (carga o estado terminal), y entonces no hay nada que revelar.
 */
export function useStagedSections(sections: readonly SectionId[] | null): StagedSections {
  const [revealed, setRevealed] = useState(false);
  const hasProfile = sections !== null;

  useEffect(() => {
    if (hasProfile && !revealed) startTransition(() => setRevealed(true));
  }, [hasProfile, revealed]);

  const visible = useMemo(
    () => (revealed || !sections ? sections : sections.filter((id) => id === 'hero')),
    [revealed, sections],
  );
  return { sections: visible, pending: hasProfile && !revealed, revealed };
}
