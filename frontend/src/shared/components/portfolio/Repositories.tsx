import { ArrowUpRight, GitBranch } from 'lucide-react';
import { useLocale } from '@/shared/i18n/use-locale';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

/**
 * Repositorios destacados de GitHub (change `add-featured-repositories`, D8). Vive en un chunk
 * aparte: `section-registry` lo carga con `lazyWithPreload` y la vista lo precarga cuando
 * `sections` trae `repositories`. No llama a GitHub ni carga nada de otros orígenes: el nombre
 * es un enlace de navegación.
 */
export function Repositories({ data }: SectionProps) {
  const { t } = useLocale();

  return (
    <MotionSection id="repositories" aria-labelledby="repositories-title" className="mb-section">
      <SectionHeading
        eyebrow={t('section.repositories.eyebrow')}
        title={t('section.repositories.title')}
      />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.repositories.map((repository) => (
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
            </div>
            <p className="mb-4 text-sm text-text-muted">{repository.description}</p>
            {repository.technologies.length > 0 && (
              <ul className="mt-auto flex flex-wrap gap-1.5">
                {repository.technologies.map((tech) => (
                  <li key={tech} className="chip">
                    {tech}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </MotionSection>
  );
}
