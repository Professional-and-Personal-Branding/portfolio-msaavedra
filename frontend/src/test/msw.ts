import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import { makeCuratedProfile, makeCuratedProfileList } from './fixtures/curated-profile';

export const API = 'http://api.test/api';

/** Handlers por defecto: perfil `all`, `demo`, y el listado. */
export const defaultHandlers: HttpHandler[] = [
  http.get(`${API}/curated-profiles`, () => HttpResponse.json(makeCuratedProfileList())),
  http.get(`${API}/curated-profiles/:slug`, ({ params }) => {
    const slug = String(params.slug);
    if (slug === 'all' || slug === 'demo') {
      return HttpResponse.json(
        makeCuratedProfile({ slug, title: slug === 'all' ? 'Perfil completo' : 'Perfil demo' }),
      );
    }
    return HttpResponse.json(
      { statusCode: 404, message: 'Not Found', error: 'Not Found' },
      { status: 404 },
    );
  }),
];

export const server = setupServer(...defaultHandlers);
export { http, HttpResponse };
