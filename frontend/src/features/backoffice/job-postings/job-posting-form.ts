import { z } from 'zod';

/** Mensajes literales: los cita el manual y `manual:check` los busca en este archivo (D18). */
export const JOB_POSTING_MESSAGES = {
  urlRequired: 'Pegá la URL de la vacante',
  urlHttps: 'Usá una URL que empiece con https://',
  urlMax: 'Usá como máximo 2048 caracteres',
  textMin: 'Pegá al menos 50 caracteres del texto de la vacante',
  textMax: 'Usá como máximo 50000 caracteres',
  titleMax: 'Usá como máximo 200 caracteres',
  companyMax: 'Usá como máximo 160 caracteres',
  tagsRequired: 'Elegí al menos un tag',
  draftTitleMax: 'Usá como máximo 120 caracteres',
  slugFormat: 'Usá solo minúsculas, números y guiones',
  slugMax: 'Usá como máximo 100 caracteres',
  rateLimited: 'Hiciste muchas importaciones seguidas. Esperá un minuto.',
} as const;

export const MIN_TEXT_LENGTH = 50;
export const MAX_TEXT_LENGTH = 50_000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export type IntakeMode = 'url' | 'text';

export interface IntakeFormValues {
  mode: IntakeMode;
  url: string;
  text: string;
  title: string;
  company: string;
  referenceUrl: string;
}

export const EMPTY_INTAKE: IntakeFormValues = {
  mode: 'url',
  url: '',
  text: '',
  title: '',
  company: '',
  referenceUrl: '',
};

/**
 * Reglas del servidor (D6, D7) con los mensajes de D18: con «URL» solo cuenta la URL; con
 * «Texto», el texto y los opcionales. Lo que el cliente no puede juzgar (portales cerrados,
 * direcciones no públicas) lo responde el servidor con un 422 y se muestra tal cual.
 */
export const intakeSchema = z
  .object({
    mode: z.enum(['url', 'text']),
    url: z.string(),
    text: z.string(),
    title: z.string(),
    company: z.string(),
    referenceUrl: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: keyof IntakeFormValues, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if (values.mode === 'url') {
      const url = values.url.trim();
      if (url === '') issue('url', JOB_POSTING_MESSAGES.urlRequired);
      else if (url.length > 2048) issue('url', JOB_POSTING_MESSAGES.urlMax);
      else if (!isHttps(url)) issue('url', JOB_POSTING_MESSAGES.urlHttps);
      return;
    }

    const length = values.text.trim().length;
    if (length < MIN_TEXT_LENGTH) issue('text', JOB_POSTING_MESSAGES.textMin);
    else if (length > MAX_TEXT_LENGTH) issue('text', JOB_POSTING_MESSAGES.textMax);
    if (values.title.trim().length > 200) issue('title', JOB_POSTING_MESSAGES.titleMax);
    if (values.company.trim().length > 160) issue('company', JOB_POSTING_MESSAGES.companyMax);
    const reference = values.referenceUrl.trim();
    if (reference !== '' && reference.length > 2048) {
      issue('referenceUrl', JOB_POSTING_MESSAGES.urlMax);
    } else if (reference !== '' && !isHttps(reference)) {
      issue('referenceUrl', JOB_POSTING_MESSAGES.urlHttps);
    }
  });

/** Cuerpo de `POST /api/admin/job-postings`: `url` XOR `text`, con los opcionales no vacíos. */
export function toImportBody(values: IntakeFormValues): {
  url?: string;
  text?: string;
  title?: string;
  company?: string;
  referenceUrl?: string;
} {
  if (values.mode === 'url') return { url: values.url.trim() };
  const title = values.title.trim();
  const company = values.company.trim();
  const referenceUrl = values.referenceUrl.trim();
  return {
    text: values.text.trim(),
    ...(title ? { title } : {}),
    ...(company ? { company } : {}),
    ...(referenceUrl ? { referenceUrl } : {}),
  };
}

export interface DraftFormValues {
  title: string;
  slug: string;
}

/** Título y slug opcionales del borrador; los tags elegidos se validan aparte (casillas). */
export const draftSchema = z.object({
  title: z.string().trim().max(120, JOB_POSTING_MESSAGES.draftTitleMax),
  slug: z
    .string()
    .trim()
    .max(100, JOB_POSTING_MESSAGES.slugMax)
    .refine((value) => value === '' || SLUG_PATTERN.test(value), JOB_POSTING_MESSAGES.slugFormat),
});

/** `null` si hay al menos un tag; si no, el mensaje de D18. */
export function validateChosenTags(tags: readonly string[]): string | null {
  return tags.length === 0 ? JOB_POSTING_MESSAGES.tagsRequired : null;
}
