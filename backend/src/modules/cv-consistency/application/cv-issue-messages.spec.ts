import { SUPPORTED_LOCALES } from '../../../shared/domain/i18n';
import { CV_ISSUE_CODES, CvIssue } from '../domain/cv-issue';
import { AS_OF, cleanSnapshot, SEEDED_MUTATIONS } from '../domain/cv-rules.seeded.fixture';
import { runCvRules } from '../domain/run-cv-rules';
import {
  CV_ISSUE_TEMPLATES,
  cvEntityLabel,
  cvIssueMessage,
  DERIVED_TEMPLATE_VARIABLES,
  templateVariables,
} from './cv-issue-messages';

const emitted = (code: (typeof CV_ISSUE_CODES)[number]): CvIssue => {
  const found = runCvRules(SEEDED_MUTATIONS[code].mutate(cleanSnapshot()), { asOf: AS_OF }).find(
    (i) => i.code === code,
  );
  if (found === undefined) throw new Error(`la mutación de ${code} no produjo el código`);
  return found;
};

describe('cv-issue-messages', () => {
  it('cada código tiene plantilla en español e inglés', () => {
    for (const code of CV_ISSUE_CODES) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(CV_ISSUE_TEMPLATES[code][locale].trim().length).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(CV_ISSUE_TEMPLATES).sort()).toEqual([...CV_ISSUE_CODES].sort());
  });

  it.each(CV_ISSUE_CODES.map((code) => [code]))(
    '%s: cada {variable} existe en los params que emite la regla (o es derivada)',
    (code) => {
      const found = emitted(code);
      const known = new Set<string>([...Object.keys(found.params), ...DERIVED_TEMPLATE_VARIABLES]);
      for (const locale of SUPPORTED_LOCALES) {
        for (const name of templateVariables(code, locale)) expect(known).toContain(name);
      }
    },
  );

  it.each(CV_ISSUE_CODES.flatMap((code) => SUPPORTED_LOCALES.map((l) => [code, l] as const)))(
    '%s (%s): el mensaje no deja variables sin interpolar',
    (code, locale) => {
      expect(cvIssueMessage(emitted(code), locale)).not.toMatch(/[{}]/);
    },
  );

  it('mensajes literales en español del diseño (D8)', () => {
    const msg = (code: (typeof CV_ISSUE_CODES)[number]) => cvIssueMessage(emitted(code), 'es');
    expect(msg('i18n.missing-translation')).toBe('Falta el texto en inglés de summary.');
    expect(msg('certification.expired')).toBe(
      'Venció en 2025-12: el sitio la muestra como «Vencida».',
    );
    expect(msg('date.invalid-format')).toBe(
      'startDate no tiene un formato válido (AAAA-MM): «2024-13».',
    );
    expect(msg('url.invalid')).toBe('url no es una URL válida.');
    expect(msg('url.not-https')).toBe('url usa http; conviene https.');
    expect(msg('curated.no-experiences')).toBe(
      'Con sus criterios actuales no muestra ninguna experiencia.',
    );
    expect(msg('curated.orphan-reference')).toBe(
      'excludeIds incluye el id no-existe, que no corresponde a ninguna experiencia, skill ni proyecto.',
    );
  });

  it('la URL de una certificación aclara que tiene que ser https', () => {
    const found: CvIssue = {
      code: 'url.invalid',
      severity: 'error',
      entityType: 'certification',
      entityId: 'c1',
      field: 'verificationUrl',
      params: {},
    };
    expect(cvIssueMessage(found, 'es')).toBe(
      'verificationUrl no es una URL válida (tiene que ser https).',
    );
    expect(cvIssueMessage(found, 'en')).toBe('verificationUrl is not a valid URL (must be https).');
  });

  describe('cvEntityLabel', () => {
    const snapshot = cleanSnapshot();
    const label = (
      entityType: CvIssue['entityType'],
      entityId: string,
      locale: 'es' | 'en' = 'es',
    ) =>
      cvEntityLabel(
        snapshot,
        { code: 'url.invalid', severity: 'error', entityType, entityId, field: null, params: {} },
        locale,
      );

    it('resuelve la etiqueta de cada tipo de entidad', () => {
      expect(label('profile', 'profile-1')).toBe('Ana Ejemplo');
      expect(label('language', 'lang-1')).toBe('Español');
      expect(label('language', 'lang-1', 'en')).toBe('Spanish');
      expect(label('experience', 'exp-a')).toBe('Acme');
      expect(label('skillCategory', 'cat-1')).toBe('Backend');
      expect(label('skill', 'skill-1')).toBe('NestJS');
      expect(label('education', 'edu-1')).toBe('Ingeniería');
      expect(label('education', 'edu-1', 'en')).toBe('Engineering');
      expect(label('certification', 'cert-1', 'en')).toBe('Certification');
      expect(label('project', 'proj-1')).toBe('Portafolio');
      expect(label('socialLink', 'link-1')).toBe('github');
      expect(label('curatedProfile', 'cp-1')).toBe('backend');
    });

    it('si el ítem ya no está, cae al id', () => {
      expect(label('experience', 'no-esta')).toBe('no-esta');
    });
  });
});
