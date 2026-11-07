import type { Response } from 'express';
import { Locale } from '../../../../shared/domain/i18n';
import { CuratedVisibility } from '../../domain/entities/curated-profile.entity';

/** Esquema del documento: el contrato es el estándar externo, no una clase Swagger propia (D10). */
export const JSON_RESUME_RESPONSE_SCHEMA = {
  type: 'object' as const,
  description:
    'Documento JSON Resume v1.0.0 (https://jsonresume.org/schema), con `$schema` apuntando al schema del tag v1.0.0. ' +
    'Solo claves del schema; las listas y los textos vacíos se omiten.',
  additionalProperties: true,
  externalDocs: {
    description: 'JSON Schema de JSON Resume v1.0.0',
    url: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
  },
};

export const RESUME_RESPONSE_HEADERS = {
  'Content-Language': { description: 'Locale servido', schema: { type: 'string' } },
  'Content-Disposition': {
    description: 'Descarga como `<slug canónico>.<locale>.resume.json`',
    schema: { type: 'string' },
  },
  'X-Robots-Tag': {
    description: '`noindex`: lo indexable es la página',
    schema: { type: 'string' },
  },
  'Cache-Control': {
    description: '`no-cache` (PUBLIC) o `private, no-store` (PROTECTED y panel)',
    schema: { type: 'string' },
  },
};

/** Nombre del archivo descargado: el slug es `[a-z0-9-]`, no hace falta `filename*`. */
export function resumeFilename(slug: string, locale: Locale): string {
  return `${slug}.${locale}.resume.json`;
}

/**
 * Cabeceras de una exportación 200 (D6). `Cache-Control` es `no-cache` solo para un perfil público
 * por slug; un PROTECTED o la ruta del panel dependen de un secreto o de la sesión.
 */
export function setResumeHeaders(
  res: Response,
  options: { slug: string; locale: Locale; cache: 'revalidate' | 'private' },
): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${resumeFilename(options.slug, options.locale)}"`,
  );
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Cache-Control', options.cache === 'private' ? 'private, no-store' : 'no-cache');
}

/** `PUBLIC` revalida; `PROTECTED` (y cualquier otra) no se guarda. */
export function cacheFor(visibility: CuratedVisibility): 'revalidate' | 'private' {
  return visibility === 'PUBLIC' ? 'revalidate' : 'private';
}
