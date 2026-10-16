import { ArrowUpRight, FolderGit2 } from 'lucide-react';
import { useLocale } from '@/shared/i18n/use-locale';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

export function Projects({ data }: SectionProps) {
  const { t } = useLocale();

  return (
    <MotionSection id="projects" aria-labelledby="projects-title" className="mb-section">
      <SectionHeading eyebrow={t('section.projects.eyebrow')} title={t('section.projects.title')} />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.projects.map((project) => (
          <li
            key={project.id}
            className="surface flex flex-col p-card transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-brand hover:glow-brand"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-theme-sm border border-border bg-bg-soft text-brand-ink">
                <FolderGit2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-tight">{project.name}</h3>
                <p className="text-xs text-text-dim">
                  {project.role} · {project.period}
                </p>
              </div>
            </div>
            <p className="mb-4 text-sm text-text-muted">{project.summary}</p>
            <ul className="mb-4 flex flex-wrap gap-1.5">
              {project.technologies.map((tech) => (
                <li key={tech} className="chip">
                  {tech}
                </li>
              ))}
            </ul>
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
              >
                {t('project.visit')}
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ul>
    </MotionSection>
  );
}
