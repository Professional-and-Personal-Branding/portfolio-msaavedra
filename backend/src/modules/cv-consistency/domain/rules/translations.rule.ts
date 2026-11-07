import {
  isMissingTranslation,
  Locale,
  LocalizedField,
  SUPPORTED_LOCALES,
} from '../../../../shared/domain/i18n';
import { CvEntityType, CvIssue, CvRuleContext, issue } from '../cv-issue';
import { CvSnapshot } from '../cv-snapshot';

/** Cantidad de ítems de una lista bilingüe si ese idioma tiene contenido; `null` si no. */
function highlightsCount(field: LocalizedField, locale: Locale): number | null {
  if (field == null || typeof field === 'string' || Array.isArray(field)) return null;
  const list = (field as Partial<Record<Locale, string[]>>)[locale];
  if (list === undefined || list.every((item) => item.trim() === '')) return null;
  return list.length;
}

/**
 * Reglas de traducción (D7). El predicado es el del aviso del constructor
 * (`isMissingTranslation`), pero se recorren los dos idiomas. Solo ítems visibles (lo oculto no
 * lo ve nadie) y perfiles curados no archivados (los archivados responden 404). Los nombres de
 * skills son planos y no se revisan.
 */
export function translationsRule(snapshot: CvSnapshot, _ctx: CvRuleContext): CvIssue[] {
  const found: CvIssue[] = [];
  const check = (
    entityType: CvEntityType,
    id: string,
    fields: Record<string, LocalizedField>,
  ): void => {
    for (const [field, value] of Object.entries(fields)) {
      for (const locale of SUPPORTED_LOCALES) {
        if (isMissingTranslation(value, locale)) {
          found.push(issue('i18n.missing-translation', entityType, id, field, { locale }));
        }
      }
    }
  };

  const { profile } = snapshot;
  if (profile !== null) {
    check('profile', profile.id, {
      headline: profile.headline,
      summary: profile.summary,
      'availability.modality': profile.availabilityModality,
      'availability.contractType': profile.availabilityContractType,
      'availability.startDate': profile.availabilityStartDate,
    });
  }
  for (const l of snapshot.languages) {
    check('language', l.id, { nameI18n: l.nameI18n, level: l.level, detail: l.detail });
  }
  for (const e of snapshot.experiences) {
    if (!e.visible) continue;
    check('experience', e.id, { role: e.role, summary: e.summary, highlights: e.highlights });
    const es = highlightsCount(e.highlights, 'es');
    const en = highlightsCount(e.highlights, 'en');
    if (es !== null && en !== null && es !== en) {
      found.push(
        issue('i18n.highlights-count-mismatch', 'experience', e.id, 'highlights', { es, en }),
      );
    }
  }
  for (const c of snapshot.skillCategories) check('skillCategory', c.id, { name: c.name });
  for (const p of snapshot.projects) {
    if (p.visible) check('project', p.id, { role: p.role, summary: p.summary });
  }
  for (const e of snapshot.education) {
    if (e.visible) check('education', e.id, { degree: e.degree });
  }
  for (const c of snapshot.certifications) {
    if (c.visible) check('certification', c.id, { name: c.name });
  }
  for (const s of snapshot.socialLinks) {
    if (s.visible) check('socialLink', s.id, { label: s.label, description: s.description });
  }
  for (const c of snapshot.curatedProfiles) {
    if (c.archived) continue;
    check('curatedProfile', c.id, {
      title: c.title,
      headline: c.headline,
      description: c.description,
      roleType: c.roleType,
    });
  }
  return found;
}
