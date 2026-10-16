// @ts-check
/*
 * Petición temprana del perfil curado (D5 de `improve-mobile-performance`).
 *
 * Script clásico, sin módulos: se carga con `async` desde el <head> y pide el perfil mientras
 * se descarga el bundle. La app lo toma una sola vez (`features/curated-view/early-profile.ts`)
 * si la clave coincide con la de su consulta; si no, ignora esta respuesta y pide la suya.
 *
 * Replica a propósito la lógica de la app: slug de `useParams` (`/` = `all`, `/:slug` de un
 * segmento), idioma de `useLocale` (`?lang=` > `navigator.language`) y token de `readUrlState`.
 * `early-profile.spec.ts` ejecuta este archivo sobre una matriz de URLs y la compara con la app.
 * No va en /admin ni en rutas de más de un segmento. Cualquier excepción: no pide nada.
 */
(function () {
  try {
    var path = window.location.pathname;
    var slug = path === '/' ? 'all' : (/^\/([^/]+)\/?$/.exec(path) || [])[1];
    if (!slug || slug === 'admin') return;
    slug = decodeURIComponent(slug);

    var params = new URLSearchParams(window.location.search);
    var lang = params.get('lang');
    var locale =
      lang === 'es' || lang === 'en'
        ? lang
        : (window.navigator.language || '').toLowerCase().indexOf('en') === 0
          ? 'en'
          : 'es';
    var token = params.get('token') || null;

    /** @type {Record<string, string>} */
    var headers = {};
    if (token) headers['X-Access-Token'] = token;
    var url = '/api/curated-profiles/' + encodeURIComponent(slug) + '?locale=' + locale;
    var response = window.fetch(url, { credentials: 'include', headers: headers });
    // Sin esto, un fallo de red dejaría un rechazo sin manejar si la app no llega a tomarla.
    response.catch(function () {});

    window.__portfolioEarlyProfile = {
      key: JSON.stringify([slug, locale, token]),
      response: response,
    };
  } catch {
    // Sin petición temprana: la app pide el perfil como siempre.
  }
})();
