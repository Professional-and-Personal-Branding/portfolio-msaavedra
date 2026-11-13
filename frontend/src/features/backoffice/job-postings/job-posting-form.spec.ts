import { describe, expect, it } from 'vitest';
import {
  draftSchema,
  EMPTY_INTAKE,
  intakeSchema,
  JOB_POSTING_MESSAGES,
  toImportBody,
  validateChosenTags,
  type IntakeFormValues,
} from './job-posting-form';

const url = (over: Partial<IntakeFormValues> = {}): IntakeFormValues => ({
  ...EMPTY_INTAKE,
  mode: 'url',
  ...over,
});
const text = (over: Partial<IntakeFormValues> = {}): IntakeFormValues => ({
  ...EMPTY_INTAKE,
  mode: 'text',
  text: 'a'.repeat(60),
  ...over,
});

function messages(values: IntakeFormValues): Record<string, string> {
  const result = intakeSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('intakeSchema — modo URL', () => {
  it('URL vacía: «Pegá la URL de la vacante»', () => {
    expect(messages(url({ url: '  ' }))).toEqual({ url: JOB_POSTING_MESSAGES.urlRequired });
  });

  it('http:// o algo que no es URL: «Usá una URL que empiece con https://»', () => {
    expect(messages(url({ url: 'http://careers.acme.com/1' }))).toEqual({
      url: 'Usá una URL que empiece con https://',
    });
    expect(messages(url({ url: 'careers.acme.com' })).url).toBe(JOB_POSTING_MESSAGES.urlHttps);
  });

  it('una URL https pasa; los campos del modo Texto no cuentan', () => {
    expect(messages(url({ url: 'https://jobs.lever.co/acme/1', text: 'x' }))).toEqual({});
  });
});

describe('intakeSchema — modo Texto', () => {
  it('49 caracteres: «Pegá al menos 50 caracteres del texto de la vacante»', () => {
    expect(messages(text({ text: 'a'.repeat(49) }))).toEqual({
      text: 'Pegá al menos 50 caracteres del texto de la vacante',
    });
  });

  it('50 pasan, 50 000 pasan y 50 001 dan «Usá como máximo 50000 caracteres»', () => {
    expect(messages(text({ text: 'a'.repeat(50) }))).toEqual({});
    expect(messages(text({ text: 'a'.repeat(50_000) }))).toEqual({});
    expect(messages(text({ text: 'a'.repeat(50_001) }))).toEqual({
      text: 'Usá como máximo 50000 caracteres',
    });
  });

  it('el texto se mide recortado', () => {
    expect(messages(text({ text: `  ${'a'.repeat(49)}  ` })).text).toBe(
      JOB_POSTING_MESSAGES.textMin,
    );
  });

  it('la URL de referencia debe ser https; vacía es válida', () => {
    expect(messages(text({ referenceUrl: 'http://x.acme.com' }))).toEqual({
      referenceUrl: 'Usá una URL que empiece con https://',
    });
    expect(messages(text({ referenceUrl: 'https://www.linkedin.com/jobs/view/1' }))).toEqual({});
    expect(messages(text({ referenceUrl: '' }))).toEqual({});
  });

  it('título y empresa tienen tope', () => {
    expect(messages(text({ title: 'a'.repeat(201) })).title).toBe(JOB_POSTING_MESSAGES.titleMax);
    expect(messages(text({ company: 'a'.repeat(161) })).company).toBe(
      JOB_POSTING_MESSAGES.companyMax,
    );
  });
});

describe('toImportBody', () => {
  it('con URL manda solo la URL recortada', () => {
    expect(toImportBody(url({ url: ' https://x.acme.com/1 ', text: 'ignorado' }))).toEqual({
      url: 'https://x.acme.com/1',
    });
  });

  it('con texto manda el texto y solo los opcionales no vacíos', () => {
    expect(
      toImportBody(
        text({ title: ' T ', company: '', referenceUrl: ' https://www.linkedin.com/jobs/view/1 ' }),
      ),
    ).toEqual({
      text: 'a'.repeat(60),
      title: 'T',
      referenceUrl: 'https://www.linkedin.com/jobs/view/1',
    });
  });
});

describe('borrador', () => {
  it('cero tags elegidos: «Elegí al menos un tag»; con uno, sin error', () => {
    expect(validateChosenTags([])).toBe('Elegí al menos un tag');
    expect(validateChosenTags(['java'])).toBeNull();
  });

  it('el slug opcional debe ser kebab-case', () => {
    expect(draftSchema.safeParse({ title: 'T', slug: '' }).success).toBe(true);
    expect(draftSchema.safeParse({ title: 'T', slug: 'mi-perfil-2' }).success).toBe(true);
    expect(draftSchema.safeParse({ title: 'T', slug: 'Mi Perfil' }).success).toBe(false);
    expect(draftSchema.safeParse({ title: 'a'.repeat(121), slug: '' }).success).toBe(false);
  });
});
