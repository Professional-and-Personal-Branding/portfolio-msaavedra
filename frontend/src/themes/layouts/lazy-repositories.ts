import type { SectionProps } from '@/shared/components/portfolio/types';
import { lazyWithPreload } from '@/shared/lib/lazy-with-preload';

/**
 * La sección de repositorios, fuera del arranque (D8 de `add-featured-repositories`): su
 * componente llega en un chunk aparte y la vista lo precarga cuando `sections` trae
 * `repositories`. Nadie más debe importar `Repositories` de forma estática (lo vigila
 * `perf:budget`).
 */
export const LazyRepositories = lazyWithPreload<SectionProps>(() =>
  import('@/shared/components/portfolio/Repositories').then((module) => ({
    default: module.Repositories,
  })),
);

/** Pide el chunk de la sección (una sola vez). */
export function preloadRepositories(): Promise<void> {
  return LazyRepositories.preload();
}
