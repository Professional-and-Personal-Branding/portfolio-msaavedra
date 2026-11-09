import { z } from 'zod';
import type { Application, ApplicationStatus, CreateApplicationBody } from '../shared/admin-types';

/** Mensajes literales: los cita el manual y `manual:check` los busca en este archivo (D11). */
export const APPLICATION_MESSAGES = {
  company: 'Escribí la empresa',
  role: 'Escribí el puesto',
  companyMax: 'Usá como máximo 120 caracteres',
  roleMax: 'Usá como máximo 160 caracteres',
  notesMax: 'Usá como máximo 5000 caracteres',
  jobUrl: 'Usá una URL que empiece con http:// o https://',
  jobUrlMax: 'Usá como máximo 2048 caracteres',
  portal: 'Usá solo minúsculas, números y guiones (hasta 32)',
  appliedAtFuture: 'La fecha no puede ser futura',
  appliedAtFormat: 'Usá una fecha válida',
  transition: 'Ese cambio de estado no está permitido. Elegí uno de la lista.',
  shareLinkTaken: 'Ese enlace ya está asociado a otra postulación.',
} as const;

const PORTAL_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ApplicationFormValues {
  company: string;
  role: string;
  jobUrl: string;
  portal: string;
  status: ApplicationStatus;
  /** `AAAA-MM-DD`; vacío con *Por postular*. */
  appliedAt: string;
  curatedProfileId: string;
  shareLinkId: string;
  notes: string;
}

/**
 * Reglas del servidor (D2, D4) con los mensajes de D11. `today` es la fecha local `AAAA-MM-DD`
 * (se inyecta para poder fijar el reloj en los tests). Con *Por postular* la fecha no se mira.
 */
export function createApplicationSchema(today: string) {
  return z
    .object({
      company: z
        .string()
        .trim()
        .min(1, APPLICATION_MESSAGES.company)
        .max(120, APPLICATION_MESSAGES.companyMax),
      role: z
        .string()
        .trim()
        .min(1, APPLICATION_MESSAGES.role)
        .max(160, APPLICATION_MESSAGES.roleMax),
      jobUrl: z
        .string()
        .trim()
        .max(2048, APPLICATION_MESSAGES.jobUrlMax)
        .refine((value) => value === '' || isHttpUrl(value), APPLICATION_MESSAGES.jobUrl),
      portal: z
        .string()
        .trim()
        .refine((value) => value === '' || PORTAL_PATTERN.test(value), APPLICATION_MESSAGES.portal),
      status: z.enum([
        'DRAFT',
        'APPLIED',
        'INTERVIEWING',
        'OFFER',
        'ACCEPTED',
        'REJECTED',
        'WITHDRAWN',
      ]),
      appliedAt: z.string(),
      curatedProfileId: z.string(),
      shareLinkId: z.string(),
      notes: z.string().trim().max(5000, APPLICATION_MESSAGES.notesMax),
    })
    .superRefine((values, context) => {
      if (values.status === 'DRAFT' || values.appliedAt === '') return;
      if (!DAY_PATTERN.test(values.appliedAt) || Number.isNaN(Date.parse(values.appliedAt))) {
        context.addIssue({
          code: 'custom',
          path: ['appliedAt'],
          message: APPLICATION_MESSAGES.appliedAtFormat,
        });
      } else if (values.appliedAt > today) {
        context.addIssue({
          code: 'custom',
          path: ['appliedAt'],
          message: APPLICATION_MESSAGES.appliedAtFuture,
        });
      }
    });
}

export const EMPTY_APPLICATION: ApplicationFormValues = {
  company: '',
  role: '',
  jobUrl: '',
  portal: '',
  status: 'DRAFT',
  appliedAt: '',
  curatedProfileId: '',
  shareLinkId: '',
  notes: '',
};

export function toApplicationValues(application: Application): ApplicationFormValues {
  return {
    company: application.company,
    role: application.role,
    jobUrl: application.jobUrl ?? '',
    portal: application.portal ?? '',
    status: application.status,
    appliedAt: application.appliedAt ?? '',
    curatedProfileId: application.curatedProfileId ?? '',
    shareLinkId: application.shareLink?.id ?? '',
    notes: application.notes ?? '',
  };
}

/**
 * Cuerpo para crear o editar. Lo opcional vacío viaja como `null` (en el PATCH, vaciar);
 * la fecha solo viaja fuera de *Por postular* y si hay valor: sin ella el servidor pone hoy.
 */
export function toApplicationBody(values: ApplicationFormValues): CreateApplicationBody {
  const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
  const appliedAt =
    values.status !== 'DRAFT' && values.appliedAt !== '' ? values.appliedAt : undefined;
  return {
    company: values.company.trim(),
    role: values.role.trim(),
    jobUrl: orNull(values.jobUrl),
    portal: orNull(values.portal),
    notes: orNull(values.notes),
    status: values.status,
    ...(appliedAt === undefined ? {} : { appliedAt }),
    curatedProfileId: orNull(values.curatedProfileId),
    shareLinkId: orNull(values.shareLinkId),
  };
}
