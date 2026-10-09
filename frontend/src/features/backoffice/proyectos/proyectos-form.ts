import { z } from 'zod';
import type {
  AdminProject,
  AdminSocialLink,
  CreateProjectBody,
  CreateSocialLinkBody,
} from '../shared/admin-types';
import { toLocalizedPayload } from '../shared/fields/localized';

/** Igual que el `@IsUrl({ protocols: ['http','https'], require_protocol: true })` del backend. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Resultado de leer el JSON de `stats`: vacío = null; solo objetos planos. */
export function parseStats(
  text: string,
): { ok: true; value: Record<string, unknown> | null } | { ok: false } {
  if (!text.trim()) return { ok: true, value: null };
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { ok: true, value: value as Record<string, unknown> };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

const localized = z.object({ es: z.string(), en: z.string().optional() });
const requiredLocalized = (message: string) =>
  localized.refine((v) => v.es.trim().length > 0, { message });

function toErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// ── Proyecto ────────────────────────────────────────────────────────────────
/** Validación de cliente que replica `CreateProjectDto` (spec `admin-content-management`). */
export const projectSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  role: requiredLocalized('El rol en español es obligatorio'),
  period: z.string().trim().min(1, 'El período es obligatorio'),
  summary: requiredLocalized('El resumen en español es obligatorio'),
  technologies: z.array(z.string()),
  tags: z.array(z.string()),
  url: z.string().refine((v) => !v.trim() || isHttpUrl(v.trim()), {
    message: 'Usá una URL absoluta que empiece con http:// o https://',
  }),
  order: z.number().int('El orden debe ser un entero').min(0, 'El orden no puede ser negativo'),
  visible: z.boolean(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const EMPTY_PROJECT: ProjectFormValues = {
  name: '',
  role: { es: '', en: '' },
  period: '',
  summary: { es: '', en: '' },
  technologies: [],
  tags: [],
  url: '',
  order: 0,
  visible: true,
};

export function toProjectValues(project: AdminProject): ProjectFormValues {
  return {
    name: project.name,
    role: { es: project.role.es, en: project.role.en ?? '' },
    period: project.period,
    summary: { es: project.summary.es, en: project.summary.en ?? '' },
    technologies: [...project.technologies],
    tags: [...project.tags],
    url: project.url ?? '',
    order: project.order,
    visible: project.visible,
  };
}

/** Cuerpo para la API: la URL vacía se envía como `null` (la quita). */
export function toProjectBody(values: ProjectFormValues): CreateProjectBody {
  return {
    name: values.name.trim(),
    role: toLocalizedPayload(values.role),
    period: values.period.trim(),
    summary: toLocalizedPayload(values.summary),
    technologies: values.technologies,
    tags: values.tags,
    url: values.url.trim() || null,
    order: values.order,
    visible: values.visible,
  };
}

export function validateProject(values: ProjectFormValues): Record<string, string> {
  const result = projectSchema.safeParse(values);
  return result.success ? {} : toErrors(result.error.issues);
}

// ── Enlace social ───────────────────────────────────────────────────────────
/** Validación de cliente que replica `CreateSocialLinkDto`. */
export const socialLinkSchema = z.object({
  platform: z
    .string()
    .trim()
    .min(1, 'La plataforma es obligatoria')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, dígitos y guiones (por ejemplo, github)'),
  handle: z.string().trim().min(1, 'El usuario es obligatorio'),
  url: z
    .string()
    .trim()
    .min(1, 'La URL es obligatoria')
    .refine((v) => isHttpUrl(v), {
      message: 'Usá una URL absoluta que empiece con http:// o https://',
    }),
  label: requiredLocalized('La etiqueta en español es obligatoria'),
  description: localized.refine((v) => v.es.trim().length > 0 || !(v.en ?? '').trim(), {
    message: 'Si cargás la traducción, completá también la descripción en español',
  }),
  stats: z.string().refine((v) => parseStats(v).ok, {
    message: 'Las estadísticas deben ser un objeto JSON, por ejemplo {"repos": 67}',
  }),
  featured: z.boolean(),
  order: z.number().int('El orden debe ser un entero').min(0, 'El orden no puede ser negativo'),
  visible: z.boolean(),
});

export type SocialLinkFormValues = z.infer<typeof socialLinkSchema>;

export const EMPTY_SOCIAL_LINK: SocialLinkFormValues = {
  platform: '',
  handle: '',
  url: '',
  label: { es: '', en: '' },
  description: { es: '', en: '' },
  stats: '',
  featured: false,
  order: 0,
  visible: true,
};

export function toSocialLinkValues(link: AdminSocialLink): SocialLinkFormValues {
  return {
    platform: link.platform,
    handle: link.handle,
    url: link.url,
    label: { es: link.label.es, en: link.label.en ?? '' },
    description: { es: link.description?.es ?? '', en: link.description?.en ?? '' },
    stats: link.stats ? JSON.stringify(link.stats, null, 2) : '',
    featured: link.featured,
    order: link.order,
    visible: link.visible,
  };
}

/** Cuerpo para la API: descripción y estadísticas vacías se envían como `null`. */
export function toSocialLinkBody(values: SocialLinkFormValues): CreateSocialLinkBody {
  const stats = parseStats(values.stats);
  const description = toLocalizedPayload(values.description);
  return {
    platform: values.platform.trim(),
    handle: values.handle.trim(),
    url: values.url.trim(),
    label: toLocalizedPayload(values.label),
    description: description.es ? description : null,
    stats: stats.ok ? stats.value : null,
    featured: values.featured,
    order: values.order,
    visible: values.visible,
  };
}

export function validateSocialLink(values: SocialLinkFormValues): Record<string, string> {
  const result = socialLinkSchema.safeParse(values);
  return result.success ? {} : toErrors(result.error.issues);
}

/**
 * ¿Hay cambios respecto a los valores al abrir? Se mide sobre el cuerpo (D12) y, en `stats`,
 * también sobre el texto recortado: un JSON inválido no llega al cuerpo y se perdería sin aviso.
 */
export function isSocialLinkDirty(
  values: SocialLinkFormValues,
  initial: SocialLinkFormValues,
): boolean {
  return (
    JSON.stringify(toSocialLinkBody(values)) !== JSON.stringify(toSocialLinkBody(initial)) ||
    values.stats.trim() !== initial.stats.trim()
  );
}
