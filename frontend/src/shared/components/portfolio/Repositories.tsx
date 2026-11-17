import { ArrowUpRight, GitBranch, Star } from 'lucide-react';
import type { Locale } from '@/shared/i18n/locale';
import { useLocale } from '@/shared/i18n/use-locale';
import { formatDate, formatMonthYear, formatNumber } from '@/shared/lib/format';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

type Repository = SectionProps['data']['repositories'][number];
type Evidence = NonNullable<Repository['evidence']>;

/** `Java 92 % · HTML 6 %` (en inglés, `92%`): hasta 3 lenguajes con su porcentaje entero. */
function languagesLine(evidence: Evidence, locale: Locale): string {
  const percent = (value: number) => (locale === 'es' ? `${value} %` : `${value}%`);
  return evidence.languages
    .map((language) => `${language.name} ${percent(language.percent)}`)
    .join(' · ');
}

/**
 * Repositorios destacados de GitHub (change `add-featured-repositories`, D8). Vive en un chunk
 * aparte: `section-registry` lo carga con `lazyWithPreload` y la vista lo precarga cuando
 * `sections` trae `repositories`. No llama a GitHub ni carga nada de otros orígenes: el nombre
 * es un enlace de navegación y la evidencia (stars, lenguajes, topics, sello de verificación)
 * viene ya resuelta del servidor (change `add-github-code-evidence`, D10). Sin evidencia válida la
 * tarjeta queda exactamente como antes.
 */
export function Repositories({ data }: SectionProps) {
  const { t, locale } = useLocale();

  return (
    <MotionSection id="repositories" aria-labelledby="repositories-title" className="mb-section">
      <SectionHeading
        eyebrow={t('section.repositories.eyebrow')}
        title={t('section.repositories.title')}
      />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.repositories.map((repository) => {
          const evidence = repository.evidence;
          return (
            <li
              key={repository.id}
              className="surface flex flex-col p-card transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-brand hover:glow-brand"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-theme-sm border border-border bg-bg-soft text-brand-ink">
                  <GitBranch className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg leading-tight font-bold break-words">
                    <a
                      href={repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {repository.name}
                      <ArrowUpRight className="size-4 shrink-0" aria-hidden />{' '}
                      <span className="sr-only">— {t('repositories.open')}</span>
                    </a>
                  </h3>
                  {repository.language && (
                    <p className="text-xs text-text-dim">
                      <span className="sr-only">{t('repositories.language')}: </span>
                      {repository.language}
                    </p>
                  )}
                </div>
                {evidence && evidence.stars >= 1 && (
                  <p className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-text-muted">
                    <Star className="size-4" aria-hidden />
                    <span aria-hidden>{formatNumber(evidence.stars, locale)}</span>
                    <span className="sr-only">
                      {t('repositories.stars').replace('{n}', formatNumber(evidence.stars, locale))}
                    </span>
                  </p>
                )}
              </div>
              {evidence && (evidence.languages.length > 0 || evidence.archived) && (
                <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  {evidence.languages.length > 0 && (
                    <span>
                      <span className="sr-only">{t('repositories.languages')}: </span>
                      {languagesLine(evidence, locale)}
                    </span>
                  )}
                  {evidence.archived && (
                    <span className="rounded-theme-sm border border-border px-1.5 py-0.5 font-medium">
                      {t('repositories.archived')}
                    </span>
                  )}
                </p>
              )}
              <p className="mb-4 text-sm text-text-muted">{repository.description}</p>
              {repository.technologies.length > 0 && (
                <ul
                  className={evidence ? 'flex flex-wrap gap-1.5' : 'mt-auto flex flex-wrap gap-1.5'}
                >
                  {repository.technologies.map((tech) => (
                    <li key={tech} className="chip">
                      {tech}
                    </li>
                  ))}
                </ul>
              )}
              {evidence && (
                <div className="mt-auto flex flex-col gap-2 pt-3">
                  {evidence.topics.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label={t('repositories.topics')}>
                      {evidence.topics.map((topic) => (
                        <li key={topic} className="chip">
                          {topic}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                    {evidence.pushedAt && (
                      <span>
                        {t('repositories.lastChange').replace(
                          '{month}',
                          formatMonthYear(evidence.pushedAt, locale),
                        )}
                      </span>
                    )}
                    <span>
                      {t('repositories.verified').replace(
                        '{date}',
                        formatDate(evidence.verifiedAt, locale),
                      )}
                    </span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </MotionSection>
  );
}
