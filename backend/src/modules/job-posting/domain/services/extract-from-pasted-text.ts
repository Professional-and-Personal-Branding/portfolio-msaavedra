import { createHash } from 'node:crypto';
import { WorkplaceType } from '../entities/job-posting.entity';

/**
 * Extracción determinística de una vacante pegada (D6), sin LLM: título, modalidad, tipo de
 * empleo e idioma. Pura salvo el hash de la clave de importación, que usa `node:crypto`.
 */
export interface PastedTextInput {
  readonly text: string;
  readonly title?: string | null;
  readonly company?: string | null;
}

export interface PastedTextExtraction {
  readonly title: string;
  readonly workplaceType: WorkplaceType | null;
  readonly employmentType: string | null;
  readonly language: 'es' | 'en' | null;
}

export const MAX_TITLE_LENGTH = 200;

function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Modalidad por palabras clave ES/EN. Si hay más de una gana la primera según HYBRID > REMOTE >
 * ONSITE, porque «híbrido» suele mencionar «remoto».
 */
export function detectWorkplaceType(text: string): WorkplaceType | null {
  const folded = fold(text);
  if (/\b(?:hibrid[oa]s?|hybrid)\b/.test(folded)) return 'HYBRID';
  if (/\b(?:remot[oa]s?|remote|teletrabajo|work from home)\b/.test(folded)) return 'REMOTE';
  if (/\b(?:presencial(?:es)?|on-?site|in[- ]office)\b/.test(folded)) return 'ONSITE';
  return null;
}

export function detectEmploymentType(text: string): string | null {
  const folded = fold(text);
  if (/\b(?:full[- ]?time|tiempo completo|jornada completa)\b/.test(folded)) return 'full-time';
  if (/\b(?:part[- ]?time|medio tiempo|tiempo parcial|media jornada)\b/.test(folded)) {
    return 'part-time';
  }
  if (/\b(?:contract|contrato|contractor|freelance)\b/.test(folded)) return 'contract';
  return null;
}

const SPANISH_WORDS = new Set([
  'de',
  'la',
  'el',
  'los',
  'las',
  'y',
  'en',
  'con',
  'para',
  'por',
  'un',
  'una',
  'que',
  'del',
  'se',
  'al',
  'es',
  'como',
  'su',
  'nuestro',
  'nuestra',
  'buscamos',
  'experiencia',
  'equipo',
]);
const ENGLISH_WORDS = new Set([
  'the',
  'and',
  'of',
  'to',
  'in',
  'for',
  'with',
  'is',
  'you',
  'we',
  'our',
  'are',
  'will',
  'on',
  'as',
  'be',
  'an',
  'your',
  'team',
  'experience',
  'looking',
]);

/** `es` o `en` si uno tiene al menos el doble de palabras vacías frecuentes que el otro; si no, `null`. */
export function detectLanguage(text: string): 'es' | 'en' | null {
  let es = 0;
  let en = 0;
  for (const word of fold(text).split(/[^a-z]+/)) {
    if (SPANISH_WORDS.has(word)) es += 1;
    if (ENGLISH_WORDS.has(word)) en += 1;
  }
  if (es > 0 && es >= en * 2) return 'es';
  if (en > 0 && en >= es * 2) return 'en';
  return null;
}

export function extractFromPastedText(input: PastedTextInput): PastedTextExtraction {
  const given = input.title?.trim();
  const firstLine = input.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '');
  const title = (given || firstLine || '').slice(0, MAX_TITLE_LENGTH);

  return {
    title,
    workplaceType: detectWorkplaceType(input.text),
    employmentType: detectEmploymentType(input.text),
    language: detectLanguage(input.text),
  };
}

/** `pasted:` + SHA-256 del texto normalizado (espacios colapsados, minúsculas): D6. */
export function pastedSourceKey(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return `pasted:${createHash('sha256').update(normalized).digest('hex')}`;
}
