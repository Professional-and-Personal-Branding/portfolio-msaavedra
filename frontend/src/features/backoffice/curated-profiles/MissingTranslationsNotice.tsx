import { Info, Languages } from 'lucide-react';
import type { Locale } from '@/shared/i18n/locale';
import type { MissingTranslation, PreviewCuratedProfile } from '@/shared/types/portfolio';

const ENTITY_LABELS: Record<MissingTranslation['entity'], string> = {
  curatedProfile: 'Perfil curado',
  profile: 'Perfil base',
  experience: 'Experiencias',
  skillCategory: 'Categorías de skills',
  project: 'Proyectos',
  education: 'Educación',
  certification: 'Certificaciones',
  socialLink: 'Enlaces',
};

const ENTITY_ORDER = Object.keys(ENTITY_LABELS) as MissingTranslation['entity'][];

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  headline: 'Titular',
  description: 'Descripción',
  roleType: 'Tipo de rol',
  summary: 'Resumen',
  'availability.modality': 'Disponibilidad: modalidad',
  'availability.contractType': 'Disponibilidad: contrato',
  'availability.startDate': 'Disponibilidad: inicio',
  role: 'Rol',
  highlights: 'Logros',
  name: 'Nombre',
  degree: 'Título académico',
  label: 'Etiqueta',
};

const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

/** Nombre legible de la entidad si el preview la trae; si no, su id. */
function entityName(data: PreviewCuratedProfile, item: MissingTranslation): string {
  switch (item.entity) {
    case 'experience': {
      const found = data.experiences.find((experience) => experience.id === item.id);
      return found ? `${found.company} — ${found.role}` : item.id;
    }
    case 'project':
      return data.projects.find((project) => project.id === item.id)?.name ?? item.id;
    case 'education':
      return data.education.find((entry) => entry.id === item.id)?.institution ?? item.id;
    case 'certification':
      return data.certifications.find((cert) => cert.id === item.id)?.name ?? item.id;
    case 'socialLink':
      return data.socialLinks.find((link) => link.id === item.id)?.label ?? item.id;
    case 'curatedProfile':
      return data.title;
    case 'profile':
      return data.profile?.fullName ?? item.id;
    default:
      return item.id;
  }
}

interface MissingTranslationsNoticeProps {
  data: PreviewCuratedProfile | undefined;
  locale: Locale;
  /** El dato mostrado es del idioma anterior y el nuevo todavía carga. */
  pending: boolean;
}

/**
 * Informe de faltantes del preview (spec `curated-profile-builder`). Es
 * informativo: no bloquea guardar ni publicar. Mientras el preview carga muestra
 * un estado neutro para no confundir "no se comprobó" con "no falta nada".
 */
export function MissingTranslationsNotice({
  data,
  locale,
  pending,
}: MissingTranslationsNoticeProps) {
  const lang = locale.toUpperCase();

  if (!data || pending) {
    return (
      <p
        data-testid="missing-translations"
        role="status"
        className="flex items-start gap-1.5 text-xs text-text-dim"
      >
        <Languages className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Comprobando traducciones en {lang}…
      </p>
    );
  }

  const missing = data.missingTranslations ?? [];
  if (missing.length === 0) {
    return (
      <p
        data-testid="missing-translations"
        role="status"
        className="flex items-start gap-1.5 text-xs text-text-dim"
      >
        <Languages className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Sin faltantes de traducción en {lang}
      </p>
    );
  }

  const groups = ENTITY_ORDER.map((entity) => ({
    entity,
    items: missing.filter((item) => item.entity === entity),
  })).filter((group) => group.items.length > 0);

  return (
    <div
      data-testid="missing-translations"
      role="status"
      className="surface flex flex-col gap-2 px-3 py-2 text-xs"
    >
      <p className="flex items-start gap-1.5 font-medium">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {missing.length === 1
          ? `Falta 1 traducción en ${lang}`
          : `Faltan ${missing.length} traducciones en ${lang}`}
      </p>
      <p className="text-text-dim">
        Es solo un aviso: podés guardar y publicar igual. Donde falta, el perfil se muestra en
        español.
      </p>
      {groups.map((group) => (
        <div key={group.entity}>
          <p className="font-medium">{ENTITY_LABELS[group.entity]}</p>
          <ul className="list-disc pl-5 text-text-dim">
            {group.items.map((item) => (
              <li key={`${item.entity}:${item.id}:${item.field}`}>
                {entityName(data, item)}: {fieldLabel(item.field)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
