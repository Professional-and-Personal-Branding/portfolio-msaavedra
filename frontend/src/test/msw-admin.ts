import { http, HttpResponse, type HttpHandler } from 'msw';
import { API } from './msw';
import {
  ADMIN,
  ADMIN_CATEGORIES,
  ADMIN_EXPERIENCES,
  ADMIN_THEMES,
  ANALYTICS,
  makeAdminCuratedProfile,
  makeCvConsistency,
} from './fixtures/admin';
import { makeCuratedProfile } from './fixtures/curated-profile';
import { ADMIN_PROJECTS, ADMIN_SOCIAL_LINKS } from './fixtures/admin';
import { ADMIN_CERTIFICATIONS, ADMIN_EDUCATION } from './fixtures/admin';

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
  http.get(`${API}/admin/curated-profiles/:id/share-links`, () => HttpResponse.json([])),
  http.get(`${API}/admin/themes`, () => HttpResponse.json(ADMIN_THEMES)),
  http.get(`${API}/admin/analytics/views`, () => HttpResponse.json(ANALYTICS)),
  http.post(`${API}/admin/curated-profiles/preview`, () => HttpResponse.json(makeCuratedProfile())),
  http.get(`${API}/admin/education`, () => HttpResponse.json(ADMIN_EDUCATION)),
  http.get(`${API}/admin/certifications`, () => HttpResponse.json(ADMIN_CERTIFICATIONS)),
  http.get(`${API}/admin/projects`, () => HttpResponse.json(ADMIN_PROJECTS)),
  http.get(`${API}/admin/social-links`, () => HttpResponse.json(ADMIN_SOCIAL_LINKS)),
  http.get(`${API}/admin/consistency`, () => HttpResponse.json(makeCvConsistency())),
];

/** Handlers sin sesión: `/auth/me` responde 401. */
export const anonymousHandlers: HttpHandler[] = [http.get(`${API}/auth/me`, () => unauthorized())];
