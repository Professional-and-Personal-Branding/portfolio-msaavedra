import { lazyWithPreload } from '@/shared/lib/lazy-with-preload';

/**
 * El backoffice va en su propio chunk: un visitante anónimo nunca lo descarga
 * (spec `admin-backoffice-shell` § Separación de la vista pública).
 */
export const BackofficeApp = lazyWithPreload(() => import('@/features/backoffice/BackofficeApp'));

/** Carga el chunk del panel antes de navegar a `/admin/*` (los tests lo usan en `beforeAll`). */
export const preloadBackoffice = BackofficeApp.preload;
