import type { Request } from 'express';
import { resolveRequestLocale } from './request-locale.decorator';

function fakeRequest(query: Record<string, unknown> = {}, acceptLanguage?: string): Request {
  return {
    query,
    headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {},
  } as unknown as Request;
}

describe('resolveRequestLocale (spec content-localization — negociación)', () => {
  it('query locale explícito', () => {
    expect(resolveRequestLocale(fakeRequest({ locale: 'en' }))).toBe('en');
  });

  it('query lang como alias', () => {
    expect(resolveRequestLocale(fakeRequest({ lang: 'en' }))).toBe('en');
  });

  it('precedencia de locale sobre lang', () => {
    expect(resolveRequestLocale(fakeRequest({ locale: 'es', lang: 'en' }))).toBe('es');
  });

  it('header Accept-Language cuando no hay query', () => {
    expect(resolveRequestLocale(fakeRequest({}, 'en-US,en;q=0.9,es;q=0.8'))).toBe('en');
  });

  it('sin indicación de idioma → es', () => {
    expect(resolveRequestLocale(fakeRequest())).toBe('es');
  });

  it('locale no soportado cae al default', () => {
    expect(resolveRequestLocale(fakeRequest({ locale: 'fr' }))).toBe('es');
  });

  it('normaliza variantes regionales y mayúsculas', () => {
    expect(resolveRequestLocale(fakeRequest({ locale: 'EN-us' }))).toBe('en');
  });

  it('un locale no soportado no corta la cadena: sigue a lang/header', () => {
    expect(resolveRequestLocale(fakeRequest({ locale: 'fr', lang: 'en' }))).toBe('en');
    expect(resolveRequestLocale(fakeRequest({ locale: 'fr' }, 'en'))).toBe('en');
  });

  it('cachea el locale resuelto en la request', () => {
    const req = fakeRequest({ locale: 'en' });
    expect(resolveRequestLocale(req)).toBe('en');
    (req as unknown as { query: Record<string, unknown> }).query = { locale: 'es' };
    expect(resolveRequestLocale(req)).toBe('en');
  });
});
