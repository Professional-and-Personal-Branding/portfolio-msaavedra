import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchRoutes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectLocale } from '@/shared/i18n/locale';
import { HOME_SLUG } from '@/shared/lib/profile-link';
import { readUrlState } from '@/shared/lib/url-state';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { earlyProfileKey } from './early-profile';
import { fetchCuratedProfile } from './hooks/use-curated-profile';

/**
 * Paridad entre `public/profile-prefetch.js` (script clásico del <head>, D5 de
 * `improve-mobile-performance`) y la app: el script ejecuta la misma lógica de slug, idioma y
 * token que `useParams`, `readUrlState` y `detectLocale`, y pide la misma URL. Si divergen, la
 * app no toma la respuesta temprana y hace una visita doble: este test lo hace fallar.
 */
// Vitest corre desde `frontend/`.
const SCRIPT = readFileSync(resolve(process.cwd(), 'public/profile-prefetch.js'), 'utf8');

/** Las rutas de `app/router.tsx` en el mismo orden de precedencia (el test de abajo lo ata al archivo). */
const ROUTES = [{ path: '/' }, { path: '/admin/*' }, { path: '/:slug' }, { path: '*' }];

const PATHS = [
  '/',
  '/tech-lead-dotnet',
  '/tech-lead-dotnet/',
  '/a%20b',
  '/%E0%A4%A',
  '/admin',
  '/admin/login',
  '/a/b',
];
const SEARCHES = ['', '?lang=en', '?lang=es', '?lang=fr', '?lang=', '?token=abc', '?token='];
const LANGUAGES = ['en-US', 'EN', 'es-BO', ''];

/** Lo que la app pide para (ruta, búsqueda, idioma): el slug de su router o nada. */
function appSlugFor(pathname: string): string | null {
  const matches = matchRoutes(ROUTES, pathname);
  const route = matches?.at(-1);
  if (route?.route.path === '/') return HOME_SLUG;
  if (route?.route.path === '/:slug') return route.params.slug ?? null;
  return null;
}

function isDecodable(segment: string): boolean {
  try {
    decodeURIComponent(segment);
    return true;
  } catch {
    return false;
  }
}

function setLanguage(language: string) {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
}

function runScript() {
  (0, eval)(SCRIPT);
}

describe('public/profile-prefetch.js — paridad con la app', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock;
    window.__portfolioEarlyProfile = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setLanguage('es-ES');
    window.history.replaceState({}, '', '/');
    window.__portfolioEarlyProfile = undefined;
  });

  it('el router de la app sigue teniendo las rutas que replica este test', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8');
    for (const route of ['path="/"', 'path="/admin/*"', 'path="/:slug"', 'path="*"']) {
      expect(source).toContain(route);
    }
  });

  describe.each(PATHS)('ruta %s', (path) => {
    it.each(SEARCHES.flatMap((search) => LANGUAGES.map((language) => [search, language] as const)))(
      'búsqueda %j, navigator.language %j',
      async (search, language) => {
        window.history.replaceState({}, '', `${path}${search}`);
        setLanguage(language);

        runScript();

        const appSlug = appSlugFor(window.location.pathname);
        const rawSegment = window.location.pathname.split('/')[1] ?? '';
        if (appSlug === null || !isDecodable(rawSegment)) {
          // /admin, rutas de más de un segmento y slugs con escapes inválidos: no pide nada.
          expect(window.__portfolioEarlyProfile).toBeUndefined();
          expect(fetchMock).not.toHaveBeenCalled();
          return;
        }

        const state = readUrlState(new URLSearchParams(window.location.search));
        const locale = state.lang ?? detectLocale(window.navigator.language);
        const early = window.__portfolioEarlyProfile;
        expect(early?.key).toBe(earlyProfileKey(appSlug, locale, state.token));

        // La petición del script es la que armaría la app: misma ruta, query y cabecera.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [scriptUrl, scriptInit] = fetchMock.mock.calls[0] ?? [];
        expect(scriptInit?.credentials).toBe('include');

        fetchMock.mockClear();
        fetchMock.mockImplementation(() =>
          Promise.resolve(Response.json(makeCuratedProfile({ slug: appSlug }))),
        );
        await fetchCuratedProfile(appSlug, locale, state.token);
        const appRequest = fetchMock.mock.calls[0]?.[0] as Request;
        const appUrl = new URL(appRequest.url);
        expect(String(scriptUrl)).toBe(`${appUrl.pathname}${appUrl.search}`);
        const scriptHeaders = new Headers(scriptInit?.headers);
        expect(scriptHeaders.get('x-access-token')).toBe(appRequest.headers.get('x-access-token'));
      },
    );
  });

  it('una excepción del navegador no deja nada ni rompe la carga', () => {
    window.history.replaceState({}, '', '/tech-lead-dotnet');
    fetchMock.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => runScript()).not.toThrow();
    expect(window.__portfolioEarlyProfile).toBeUndefined();
  });

  it('un fallo de red de la respuesta temprana no deja un rechazo sin manejar', async () => {
    window.history.replaceState({}, '', '/tech-lead-dotnet');
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('network')));

    runScript();
    await new Promise((resolve) => setTimeout(resolve, 20));

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    // La promesa sigue rechazada para la app, que la tratará como cualquier fallo de red.
    await expect(window.__portfolioEarlyProfile?.response).rejects.toThrow('network');
  });
});
