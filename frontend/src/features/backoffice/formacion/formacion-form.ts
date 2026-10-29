import { z } from 'zod';
import type {
  AdminCertification,
  AdminEducation,
  CreateCertificationBody,
  CreateEducationBody,
} from '../shared/admin-types';
import { toLocalizedPayload } from '../shared/fields/localized';

/** Mismas reglas que el dominio del backend (`validate-education`, `validate-certification`). */
export const EDUCATION_DATE_REGEX = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
export const YEAR_REGEX = /^\d{4}$/;
/** Límites de la credencial: iguales a los del dominio y el DTO (change `add-certification-verification`, D3). */
export const VERIFICATION_URL_MAX = 2048;
export const CREDENTIAL_ID_MAX = 100;

/** URL absoluta https con dominio, como la que acepta el backend (`isHttpsUrl` + `@IsUrl`). */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.');
  } catch {
    return false;
  }
}

const localized = z.object({ es: z.string(), en: z.string().optional() });

/** Compara al nivel de la menor precisión: `2021` y `2021-03` son el mismo período. */
function isAfter(start: string, end: string): boolean {
  const precision = Math.min(start.length, end.length);
  return start.slice(0, precision) > end.slice(0, precision);
}

// ── Educación ───────────────────────────────────────────────────────────────
export const educationSchema = z
  .object({
    degree: localized.refine((v) => v.es.trim().length > 0, {
      message: 'El título en español es obligatorio',
    }),
    institution: z.string().trim().min(1, 'La institución es obligatoria'),
    startDate: z
      .string()
      .trim()
      .min(1, 'La fecha de inicio es obligatoria')
      .regex(EDUCATION_DATE_REGEX, 'Usá el formato AAAA-MM o AAAA'),
    endDate: z.string(),
    inProgress: z.boolean(),
    order: z.number().int().min(0, 'El orden no puede ser negativo'),
    visible: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const end = values.endDate.trim();
    if (!end) return;
    if (values.inProgress) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Una formación en curso no lleva fecha de fin',
      });
      return;
    }
    if (!EDUCATION_DATE_REGEX.test(end)) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Usá el formato AAAA-MM o AAAA' });
      return;
    }
    const start = values.startDate.trim();
    if (EDUCATION_DATE_REGEX.test(start) && isAfter(start, end)) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'La fecha de fin no puede ser anterior al inicio',
      });
    }
  });

export type EducationFormValues = z.infer<typeof educationSchema>;

export const EMPTY_EDUCATION: EducationFormValues = {
  degree: { es: '', en: '' },
  institution: '',
  startDate: '',
  endDate: '',
  inProgress: false,
  order: 0,
  visible: true,
};

export function toEducationValues(education: AdminEducation): EducationFormValues {
  return {
    degree: { es: education.degree.es, en: education.degree.en ?? '' },
    institution: education.institution,
    startDate: education.startDate,
    endDate: education.endDate ?? '',
    inProgress: education.inProgress,
    order: education.order,
    visible: education.visible,
  };
}

/** Cuerpo para la API: `inProgress` implica `endDate: null`. */
export function toEducationBody(values: EducationFormValues): CreateEducationBody {
  return {
    degree: toLocalizedPayload(values.degree),
    institution: values.institution.trim(),
    startDate: values.startDate.trim(),
    endDate: values.inProgress ? null : values.endDate.trim() || null,
    inProgress: values.inProgress,
    order: values.order,
    visible: values.visible,
  };
}

// ── Certificaciones ─────────────────────────────────────────────────────────
export const certificationSchema = z
  .object({
    name: localized.refine((v) => v.es.trim().length > 0, {
      message: 'El nombre en español es obligatorio',
    }),
    issuer: z.string().trim().min(1, 'El emisor es obligatorio'),
    year: z
      .string()
      .trim()
      .refine((v) => v === '' || YEAR_REGEX.test(v), 'Usá el formato AAAA'),
    // Credencial (D8): los tres son opcionales; vacío = sin valor.
    verificationUrl: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || (v.length <= VERIFICATION_URL_MAX && isHttpsUrl(v)),
        'Usá una URL completa que empiece con https://',
      ),
    credentialId: z
      .string()
      .trim()
      .max(CREDENTIAL_ID_MAX, 'El ID de credencial admite hasta 100 caracteres'),
    expiresAt: z
      .string()
      .trim()
      .refine((v) => v === '' || EDUCATION_DATE_REGEX.test(v), 'Usá el formato AAAA-MM o AAAA'),
    order: z.number().int().min(0, 'El orden no puede ser negativo'),
    visible: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const year = values.year.trim();
    const expires = values.expiresAt.trim();
    if (YEAR_REGEX.test(year) && EDUCATION_DATE_REGEX.test(expires) && expires.slice(0, 4) < year) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'El vencimiento no puede ser anterior al año',
      });
    }
  });

export type CertificationFormValues = z.infer<typeof certificationSchema>;

export const EMPTY_CERTIFICATION: CertificationFormValues = {
  name: { es: '', en: '' },
  issuer: '',
  year: '',
  verificationUrl: '',
  credentialId: '',
  expiresAt: '',
  order: 0,
  visible: true,
};

export function toCertificationValues(certification: AdminCertification): CertificationFormValues {
  return {
    name: { es: certification.name.es, en: certification.name.en ?? '' },
    issuer: certification.issuer,
    year: certification.year ?? '',
    verificationUrl: certification.verificationUrl ?? '',
    credentialId: certification.credentialId ?? '',
    expiresAt: certification.expiresAt ?? '',
    order: certification.order,
    visible: certification.visible,
  };
}

export function toCertificationBody(values: CertificationFormValues): CreateCertificationBody {
  return {
    name: toLocalizedPayload(values.name),
    issuer: values.issuer.trim(),
    year: values.year.trim() || null,
    // Vacío → null: en el PATCH quita el valor guardado (D3).
    verificationUrl: values.verificationUrl.trim() || null,
    credentialId: values.credentialId.trim() || null,
    expiresAt: values.expiresAt.trim() || null,
    order: values.order,
    visible: values.visible,
  };
}

/** Errores por campo (primer mensaje de cada uno), como los consume el formulario. */
export function fieldErrors(schema: z.ZodType, values: unknown): Record<string, string> {
  const result = schema.safeParse(values);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
