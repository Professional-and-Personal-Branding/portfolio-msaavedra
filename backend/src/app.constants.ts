/** Prefijo global de todas las rutas HTTP (spec `api-platform`). */
export const GLOBAL_PREFIX = 'api';

/** Rutas que NO llevan el prefijo `/api`: sondas del orquestador y archivos para buscadores. */
export const PREFIX_EXCLUDED_ROUTES = ['health', 'health/live', 'robots.txt', 'sitemap.xml'];
