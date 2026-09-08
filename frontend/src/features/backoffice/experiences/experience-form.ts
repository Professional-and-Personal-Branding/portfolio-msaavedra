import { z } from 'zod';
import type { AdminExperience, CreateExperienceBody } from '../shared/admin-types';
import { toLocalizedListPayload, toLocalizedPayload } from '../shared/fields/localized';

const localized = z.object({ es: z.string(), en: z.string().optional() });
const localizedList = z.object({ es: z.array(z.string()), en: z.array(z.string()).optional() });

/** Validación de cliente antes de llamar a la API (spec `admin-content-management`). */
export const experienceSchema = z.object({
  company: z.string().trim().min(1, 'La empresa es obligatoria'),
  role: localized.refine((v) => v.es.trim().length > 0, {
    message: 'El rol en español es obligatorio',
  }),
  startDate: z.string().trim().min(1, 'La fecha de inicio es obligatoria'),
  endDate: z.string().nullable(),
  current: z.boolean(),
  location: z.string().trim().min(1, 'La ubicación es obligatoria'),
  summary: localized.refine((v) => v.es.trim().length > 0, {
    message: 'El resumen en español es obligatorio',
  }),
  highlights: localizedList,
  technologies: z.array(z.string()),
  tags: z.array(z.string()),
  sector: z.array(z.string()),
  order: z.number().int().min(0),
  visible: z.boolean(),
});

export type ExperienceFormValues = z.infer<typeof experienceSchema>;

export const EMPTY_EXPERIENCE: ExperienceFormValues = {
  company: '',
  role: { es: '', en: '' },
  startDate: '',
  endDate: null,
  current: false,
  location: '',
  summary: { es: '', en: '' },
  highlights: { es: [], en: [] },
  technologies: [],
  tags: [],
  sector: [],
  order: 0,
  visible: true,
};

export function toFormValues(experience: AdminExperience): ExperienceFormValues {
  return {
    company: experience.company,
    role: { es: experience.role.es, en: experience.role.en ?? '' },
    startDate: experience.startDate.slice(0, 7),
    endDate: experience.endDate ? experience.endDate.slice(0, 7) : null,
    current: experience.current,
    location: experience.location,
    summary: { es: experience.summary.es, en: experience.summary.en ?? '' },
    highlights: { es: experience.highlights.es, en: experience.highlights.en ?? [] },
    technologies: [...experience.technologies],
    tags: [...experience.tags],
    sector: [...experience.sector],
    order: experience.order,
    visible: experience.visible,
  };
}

/** Cuerpo para la API: `current` implica `endDate: null`. */
export function toExperienceBody(values: ExperienceFormValues): CreateExperienceBody {
  return {
    company: values.company.trim(),
    role: toLocalizedPayload(values.role),
    startDate: values.startDate.trim(),
    endDate: values.current ? null : values.endDate?.trim() || null,
    current: values.current,
    location: values.location.trim(),
    summary: toLocalizedPayload(values.summary),
    highlights: toLocalizedListPayload(values.highlights),
    technologies: values.technologies,
    tags: values.tags,
    sector: values.sector,
    order: values.order,
    visible: values.visible,
  };
}

/** Errores por campo, con la misma forma que consume el formulario. */
export function validateExperience(values: ExperienceFormValues): Record<string, string> {
  const result = experienceSchema.safeParse(values);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
