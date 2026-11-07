import { validateCertification } from '../../education/domain/services/validate-certification';
import { validateEducation } from '../../education/domain/services/validate-education';
import { validateExperience } from '../../experience/domain/services/validate-experience';
import { validateProject } from '../../project/domain/services/validate-project';
import { validateSocialLink } from '../../social-link/domain/services/validate-social-link';
import { CvIssueCode } from './cv-issue';
import { AS_OF, cleanSnapshot, SEEDED_MUTATIONS } from './cv-rules.seeded.fixture';
import { CvSnapshot } from './cv-snapshot';
import { runCvRules } from './run-cv-rules';

/**
 * Cruce con los validadores de escritura (Risks de `add-cv-consistency-rules`): cada defecto de
 * severidad `error` tiene que ser uno que la API del panel también rechace. Si un validador
 * aceptara el dato, la regla `error` estaría más estricta que la API y `cv:lint` frenaría un CI
 * por algo que el panel deja guardar.
 */
const ctx = { asOf: AS_OF };

const experienceProps = (s: CvSnapshot) => {
  const e = s.experiences.find((x) => x.id === 'exp-a') ?? s.experiences[0];
  return {
    company: e.company,
    role: e.role as { es: string },
    startDate: e.startDate,
    endDate: e.endDate,
    current: e.current,
    location: 'Remoto',
    summary: e.summary as { es: string },
    highlights: { es: [] },
    technologies: [],
    tags: [],
    sector: [],
    order: 0,
    visible: true,
  };
};
const educationProps = (s: CvSnapshot) => ({
  degree: { es: 'Ingeniería' },
  institution: s.education[0].institution,
  startDate: s.education[0].startDate,
  endDate: s.education[0].endDate,
  inProgress: s.education[0].inProgress,
  order: 0,
  visible: true,
});
const certificationProps = (s: CvSnapshot) => ({
  name: { es: 'Cert' },
  issuer: s.certifications[0].issuer,
  year: s.certifications[0].year,
  verificationUrl: s.certifications[0].verificationUrl,
  credentialId: null,
  expiresAt: s.certifications[0].expiresAt,
  order: 0,
  visible: true,
});
const projectProps = (s: CvSnapshot) => ({
  name: s.projects[0].name,
  role: { es: 'Autor' },
  period: '2026',
  summary: { es: 'Resumen' },
  technologies: [],
  tags: [],
  url: s.projects[0].url,
  order: 0,
  visible: true,
});
const socialLinkProps = (s: CvSnapshot) => ({
  platform: s.socialLinks[0].platform,
  handle: 'ejemplo',
  url: s.socialLinks[0].url,
  label: { es: 'Código' },
  description: null,
  stats: null,
  featured: false,
  order: 0,
  visible: true,
});

interface Case {
  readonly name: string;
  readonly code: CvIssueCode;
  readonly mutate: (s: CvSnapshot) => CvSnapshot;
  /** Devuelve `true` si el validador de escritura rechaza el dato mutado. */
  readonly rejectedByValidator: (mutated: CvSnapshot) => boolean;
}

const exp =
  (changes: Record<string, unknown>) =>
  (s: CvSnapshot): CvSnapshot => ({
    ...s,
    experiences: s.experiences.map((e) => (e.id === 'exp-a' ? { ...e, ...changes } : e)),
  });
const edu =
  (changes: Record<string, unknown>) =>
  (s: CvSnapshot): CvSnapshot => ({
    ...s,
    education: s.education.map((e) => ({ ...e, ...changes })),
  });
const cert =
  (changes: Record<string, unknown>) =>
  (s: CvSnapshot): CvSnapshot => ({
    ...s,
    certifications: s.certifications.map((c) => ({ ...c, ...changes })),
  });

const CASES: Case[] = [
  {
    name: 'experiencia: mes inexistente',
    code: 'date.invalid-format',
    mutate: exp({ startDate: '2024-13' }),
    rejectedByValidator: (m) => !validateExperience(experienceProps(m)).ok,
  },
  {
    name: 'experiencia: fin anterior al inicio',
    code: 'date.end-before-start',
    mutate: exp({ endDate: '2014-05' }),
    rejectedByValidator: (m) => !validateExperience(experienceProps(m)).ok,
  },
  {
    name: 'experiencia: actual con fin',
    code: 'date.ongoing-with-end',
    mutate: exp({ current: true, endDate: '2020-12' }),
    rejectedByValidator: (m) => !validateExperience(experienceProps(m)).ok,
  },
  {
    name: 'formación: fecha inválida',
    code: 'date.invalid-format',
    mutate: edu({ startDate: '2008-3' }),
    rejectedByValidator: (m) => !validateEducation(educationProps(m)).ok,
  },
  {
    name: 'formación: fin anterior al inicio',
    code: 'date.end-before-start',
    mutate: edu({ startDate: '2014', endDate: '2013-12' }),
    rejectedByValidator: (m) => !validateEducation(educationProps(m)).ok,
  },
  {
    name: 'formación: en curso con fin',
    code: 'date.ongoing-with-end',
    mutate: edu({ inProgress: true }),
    rejectedByValidator: (m) => !validateEducation(educationProps(m)).ok,
  },
  {
    name: 'certificación: year inválido',
    code: 'date.invalid-format',
    mutate: cert({ year: '22' }),
    rejectedByValidator: (m) => !validateCertification(certificationProps(m)).ok,
  },
  {
    name: 'certificación: expiresAt inválido',
    code: 'date.invalid-format',
    mutate: cert({ expiresAt: '2029-13' }),
    rejectedByValidator: (m) => !validateCertification(certificationProps(m)).ok,
  },
  {
    name: 'certificación: verificationUrl http',
    code: 'url.invalid',
    mutate: cert({ verificationUrl: 'http://emisor.example/x' }),
    rejectedByValidator: (m) => !validateCertification(certificationProps(m)).ok,
  },
  {
    name: 'proyecto: url no http(s)',
    code: 'url.invalid',
    mutate: SEEDED_MUTATIONS['url.invalid'].mutate,
    rejectedByValidator: (m) => !validateProject(projectProps(m)).ok,
  },
  {
    name: 'enlace social: url no http(s)',
    code: 'url.invalid',
    mutate: (s) => ({
      ...s,
      socialLinks: s.socialLinks.map((l) => ({ ...l, url: 'mailto:a@b.c' })),
    }),
    rejectedByValidator: (m) => !validateSocialLink(socialLinkProps(m)).ok,
  },
];

describe('reglas error contra los validadores de escritura', () => {
  it('los datos limpios los aceptan todos los validadores', () => {
    const clean = cleanSnapshot();
    expect(validateExperience(experienceProps(clean)).ok).toBe(true);
    expect(validateEducation(educationProps(clean)).ok).toBe(true);
    expect(validateCertification(certificationProps(clean)).ok).toBe(true);
    expect(validateProject(projectProps(clean)).ok).toBe(true);
    expect(validateSocialLink(socialLinkProps(clean)).ok).toBe(true);
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const mutated = c.mutate(cleanSnapshot());
    const emitted = runCvRules(mutated, ctx).filter((i) => i.severity === 'error');
    expect(emitted.map((i) => i.code)).toContain(c.code);
    expect(c.rejectedByValidator(mutated)).toBe(true);
  });
});
