import { describe, expect, it } from 'vitest';
import {
  APPLICATION_MESSAGES,
  createApplicationSchema,
  EMPTY_APPLICATION,
  toApplicationBody,
  toApplicationValues,
  type ApplicationFormValues,
} from './application-form';
import { makeApplication } from '@/test/fixtures/applications';

/** Reloj fijo: «hoy» es el 20 de noviembre de 2026. */
const TODAY = '2026-11-20';
const schema = createApplicationSchema(TODAY);

const VALID: ApplicationFormValues = {
  ...EMPTY_APPLICATION,
  company: 'Globex',
  role: 'Backend Senior',
};

/** Mensajes de error por campo de un conjunto de valores. */
function errorsOf(values: Partial<ApplicationFormValues>): Record<string, string> {
  const result = schema.safeParse({ ...VALID, ...values });
  if (result.success) return {};
  const found: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    if (!found[key]) found[key] = issue.message;
  }
  return found;
}

describe('application-form (D11)', () => {
  it('un alta mínima (solo empresa y puesto, Por postular) es válida', () => {
    expect(errorsOf({})).toEqual({});
  });

  it('empresa vacía → «Escribí la empresa»; puesto vacío → «Escribí el puesto»', () => {
    expect(errorsOf({ company: '   ' }).company).toBe('Escribí la empresa');
    expect(errorsOf({ role: '' }).role).toBe('Escribí el puesto');
  });

  it('empresa: 120 caracteres pasan y 121 dan el mensaje de tope', () => {
    expect(errorsOf({ company: 'a'.repeat(120) }).company).toBeUndefined();
    expect(errorsOf({ company: 'a'.repeat(121) }).company).toBe('Usá como máximo 120 caracteres');
  });

  it('puesto: 160 pasan y 161 dan el mensaje de tope', () => {
    expect(errorsOf({ role: 'a'.repeat(160) }).role).toBeUndefined();
    expect(errorsOf({ role: 'a'.repeat(161) }).role).toBe('Usá como máximo 160 caracteres');
  });

  it('notas: 5000 pasan y 5001 dan el mensaje de tope', () => {
    expect(errorsOf({ notes: 'a'.repeat(5000) }).notes).toBeUndefined();
    expect(errorsOf({ notes: 'a'.repeat(5001) }).notes).toBe('Usá como máximo 5000 caracteres');
  });

  it('URL sin esquema, ftp o relativa → «Usá una URL que empiece con http:// o https://»', () => {
    for (const jobUrl of ['globex.example', 'ftp://globex.example', '/jobs/1']) {
      expect(errorsOf({ jobUrl }).jobUrl).toBe('Usá una URL que empiece con http:// o https://');
    }
  });

  it('URL http o https y URL vacía son válidas', () => {
    expect(errorsOf({ jobUrl: 'https://globex.example/jobs/1' }).jobUrl).toBeUndefined();
    expect(errorsOf({ jobUrl: 'http://globex.example' }).jobUrl).toBeUndefined();
    expect(errorsOf({ jobUrl: '' }).jobUrl).toBeUndefined();
  });

  it('portal inválido → «Usá solo minúsculas, números y guiones (hasta 32)»', () => {
    for (const portal of ['mi portal!', 'LinkedIn', '-x', 'a'.repeat(33)]) {
      expect(errorsOf({ portal }).portal).toBe('Usá solo minúsculas, números y guiones (hasta 32)');
    }
    expect(errorsOf({ portal: 'linkedin' }).portal).toBeUndefined();
    expect(errorsOf({ portal: 'get-on-board' }).portal).toBeUndefined();
  });

  it('fecha futura con el reloj fijo → «La fecha no puede ser futura»; hoy y ayer pasan', () => {
    expect(errorsOf({ status: 'APPLIED', appliedAt: '2026-11-21' }).appliedAt).toBe(
      'La fecha no puede ser futura',
    );
    expect(errorsOf({ status: 'APPLIED', appliedAt: '2026-11-20' }).appliedAt).toBeUndefined();
    expect(errorsOf({ status: 'APPLIED', appliedAt: '2026-11-19' }).appliedAt).toBeUndefined();
  });

  it('una fecha que no es de calendario se rechaza', () => {
    expect(errorsOf({ status: 'APPLIED', appliedAt: '2026-13-45' }).appliedAt).toBe(
      APPLICATION_MESSAGES.appliedAtFormat,
    );
  });

  it('Por postular sin fecha es válido, y con Por postular la fecha no se mira', () => {
    expect(errorsOf({ status: 'DRAFT', appliedAt: '' })).toEqual({});
    expect(errorsOf({ status: 'DRAFT', appliedAt: '2999-01-01' }).appliedAt).toBeUndefined();
  });

  it('otro estado sin fecha es válido: el servidor pone hoy', () => {
    expect(errorsOf({ status: 'APPLIED', appliedAt: '' })).toEqual({});
  });

  it('los mensajes literales son los que cita el manual (D11)', () => {
    expect(Object.values(APPLICATION_MESSAGES)).toEqual(
      expect.arrayContaining([
        'Escribí la empresa',
        'Escribí el puesto',
        'Usá como máximo 120 caracteres',
        'Usá como máximo 160 caracteres',
        'Usá como máximo 5000 caracteres',
        'Usá una URL que empiece con http:// o https://',
        'Usá solo minúsculas, números y guiones (hasta 32)',
        'La fecha no puede ser futura',
        'Ese cambio de estado no está permitido. Elegí uno de la lista.',
        'Ese enlace ya está asociado a otra postulación.',
      ]),
    );
  });
});

describe('toApplicationBody', () => {
  it('recorta, manda null en lo opcional vacío y omite la fecha con Por postular', () => {
    expect(toApplicationBody({ ...VALID, company: ' Globex ', appliedAt: '2026-11-01' })).toEqual({
      company: 'Globex',
      role: 'Backend Senior',
      jobUrl: null,
      portal: null,
      notes: null,
      status: 'DRAFT',
      curatedProfileId: null,
      shareLinkId: null,
    });
  });

  it('fuera de Por postular manda la fecha si hay valor y la omite si no', () => {
    expect(
      toApplicationBody({ ...VALID, status: 'APPLIED', appliedAt: '2026-11-01' }),
    ).toMatchObject({ appliedAt: '2026-11-01' });
    expect(toApplicationBody({ ...VALID, status: 'APPLIED', appliedAt: '' })).not.toHaveProperty(
      'appliedAt',
    );
  });

  it('ida y vuelta con una postulación de la API', () => {
    const application = makeApplication({
      jobUrl: 'https://globex.example/jobs/1',
      portal: 'linkedin',
      notes: 'nota',
      curatedProfileId: 'cp-1',
      profileSlug: 'ejemplo-backend',
      shareLink: {
        id: 'sl-1',
        label: 'Enlace',
        code: 'abcdefghjk',
        revoked: false,
        opens: 0,
        firstOpenedAt: null,
        lastOpenedAt: null,
      },
    });
    const values = toApplicationValues(application);
    expect(values).toMatchObject({
      status: 'APPLIED',
      appliedAt: '2026-11-05',
      curatedProfileId: 'cp-1',
      shareLinkId: 'sl-1',
    });
    expect(toApplicationBody(values)).toMatchObject({
      company: 'Globex',
      jobUrl: 'https://globex.example/jobs/1',
      portal: 'linkedin',
      notes: 'nota',
      appliedAt: '2026-11-05',
      curatedProfileId: 'cp-1',
      shareLinkId: 'sl-1',
    });
  });
});
