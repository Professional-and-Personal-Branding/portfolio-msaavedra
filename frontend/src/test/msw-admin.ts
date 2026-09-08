import { http, HttpResponse, type HttpHandler } from 'msw';
import { API } from './msw';
import {
  ADMIN,
  ADMIN_CATEGORIES,
  ADMIN_EXPERIENCES,
  ADMIN_THEMES,
  ANALYTICS,
  makeAdminCuratedProfile,
} from './fixtures/admin';
import { makeCuratedProfile } from './fixtures/curated-profile';

export const unauthorized = () =>
  HttpResponse.json(
    { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
    {
      status: 401,
    },
  );

/** Handlers del backoffice con sesión válida. */
export const adminHandlers: HttpHandler[] = [
  http.get(`${API}/auth/me`, () => HttpResponse.json(ADMIN)),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/admin/experiences`, () => HttpResponse.json(ADMIN_EXPERIENCES)),
  http.get(`${API}/admin/skill-categories`, () => HttpResponse.json(ADMIN_CATEGORIES)),
  http.get(`${API}/admin/curated-profiles`, () => HttpResponse.json([makeAdminCuratedProfile()])),
  http.get(`${API}/admin/themes`, () => HttpResponse.json(ADMIN_THEMES)),
  http.get(`${API}/admin/analytics/views`, () => HttpResponse.json(ANALYTICS)),
  http.post(`${API}/admin/curated-profiles/preview`, () => HttpResponse.json(makeCuratedProfile())),
];

/** Handlers sin sesión: `/auth/me` responde 401. */
export const anonymousHandlers: HttpHandler[] = [http.get(`${API}/auth/me`, () => unauthorized())];
