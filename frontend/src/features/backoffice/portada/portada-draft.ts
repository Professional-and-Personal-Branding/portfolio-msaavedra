import type { AdminProfile, LocalizedText, ReplaceProfileBody } from '../shared/admin-types';
import { toLocalizedPayload } from '../shared/fields/localized';

/**
 * Borrador del perfil base (add-profile-content-admin, D1). Todo como texto
 * editable: la disponibilidad vacía viaja como `null` y el `PUT` reemplaza el
 * perfil entero.
 */
export interface PortadaDraft {
  fullName: string;
  headline: LocalizedText;
  summary: LocalizedText;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  yearsOfExperience: number;
  modality: LocalizedText;
  contractType: LocalizedText;
  startDate: LocalizedText;
}

type Raw = LocalizedText | string | null | undefined;

/** Un campo bilingüe crudo de la API como texto editable (los planos legacy van a `es`). */
function editable(value: Raw): LocalizedText {
  if (value == null) return { es: '', en: '' };
  if (typeof value === 'string') return { es: value, en: '' };
  return { es: value.es ?? '', en: value.en ?? '' };
}

export function toPortadaDraft(profile: AdminProfile): PortadaDraft {
  return {
    fullName: profile.fullName,
    headline: editable(profile.headline as Raw),
    summary: editable(profile.summary as Raw),
    email: profile.email,
    phone: profile.phone ?? '',
    location: profile.location,
    timezone: profile.timezone,
    yearsOfExperience: profile.yearsOfExperience,
    modality: editable(profile.availability.modality as Raw),
    contractType: editable(profile.availability.contractType as Raw),
    startDate: editable(profile.availability.startDate as Raw),
  };
}

/** Disponibilidad vacía en los dos idiomas → `null` (columna vacía), no `{ es: '' }`. */
function optional(value: LocalizedText): LocalizedText | null {
  const payload = toLocalizedPayload(value);
  return payload.es || payload.en ? payload : null;
}

export function toReplaceBody(draft: PortadaDraft): ReplaceProfileBody {
  return {
    fullName: draft.fullName.trim(),
    headline: toLocalizedPayload(draft.headline),
    summary: toLocalizedPayload(draft.summary),
    email: draft.email.trim(),
    phone: draft.phone.trim() || null,
    location: draft.location.trim(),
    timezone: draft.timezone.trim() || 'GMT-4',
    yearsOfExperience: draft.yearsOfExperience,
    availability: {
      modality: optional(draft.modality),
      contractType: optional(draft.contractType),
      startDate: optional(draft.startDate),
    },
  };
}

export type PortadaErrors = Partial<Record<keyof PortadaDraft, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Las mismas reglas que el dominio: lo que el hero necesita no puede quedar vacío. */
export function validatePortada(draft: PortadaDraft): PortadaErrors {
  const errors: PortadaErrors = {};
  if (!draft.fullName.trim()) errors.fullName = 'El nombre es obligatorio';
  if (!draft.headline.es.trim()) errors.headline = 'El titular en español es obligatorio';
  if (!draft.summary.es.trim()) errors.summary = 'El resumen en español es obligatorio';
  if (!EMAIL.test(draft.email.trim())) errors.email = 'El email no es válido';
  if (!draft.location.trim()) errors.location = 'La ubicación es obligatoria';
  if (!Number.isInteger(draft.yearsOfExperience) || draft.yearsOfExperience < 0) {
    errors.yearsOfExperience = 'Los años deben ser un entero mayor o igual a 0';
  }
  return errors;
}

/** Clave estable del borrador para la vista previa (cambia solo si cambia el contenido). */
export function portadaKey(draft: PortadaDraft): string {
  return JSON.stringify(toReplaceBody(draft));
}
