import { lazyWithPreload } from '@/shared/lib/lazy-with-preload';
import type { DeferredMenuInitProps } from './DeferredMenu';

/**
 * Los menús de la barra, fuera del arranque (D3 de `improve-mobile-performance`): traen Radix
 * (`DropdownMenu`, `Sheet`) y Floating UI. `TopBar` los monta con `DeferredMenu`; nadie más debe
 * importar `ThemeSwitcher` ni `ProfileMenu` de forma estática (lo vigila `perf:budget`).
 */
export const LazyThemeSwitcher = lazyWithPreload<DeferredMenuInitProps>(() =>
  import('./ThemeSwitcher').then((module) => ({ default: module.ThemeSwitcher })),
);

export const LazyProfileMenu = lazyWithPreload<DeferredMenuInitProps & { activeSlug: string }>(() =>
  import('./ProfileMenu').then((module) => ({ default: module.ProfileMenu })),
);
