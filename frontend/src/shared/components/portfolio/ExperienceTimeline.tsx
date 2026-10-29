import { useLocale } from '@/shared/i18n/use-locale';
import { formatPeriod } from '@/shared/lib/format';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

export function ExperienceTimeline({ data }: SectionProps) {
  const { t, locale } = useLocale();

  return (
    <MotionSection id="experience" aria-labelledby="experience-title" className="mb-section">
      <SectionHeading
        eyebrow={t('section.experience.eyebrow')}
        title={t('section.experience.title')}
      />
      <ol className="flex flex-col gap-4">
        {data.experiences.map((experience) => (
          <li
            key={experience.id}
            className="group surface relative overflow-hidden p-card transition-[transform,background-color] hover:translate-x-1.5"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[3px] bg-brand-gradient opacity-0 transition-opacity group-hover:opacity-100"
            />
            <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg font-bold md:text-xl">
                {experience.role}
                {experience.current && (
                  <span className="ml-2 inline-block rounded-full border border-success/30 bg-success/15 px-2 py-0.5 align-middle text-[11px] font-medium text-success-ink">
                    {t('experience.current')}
                  </span>
                )}
              </h3>
              <span className="rounded-full bg-bg-soft px-3 py-1 text-xs whitespace-nowrap text-text-dim">
                {formatPeriod(
                  experience.startDate,
                  experience.endDate,
                  locale,
                  t('experience.present'),
                )}
              </span>
            </div>
            <p className="font-semibold text-brand-ink">{experience.company}</p>
            <p className="mb-3 text-xs text-text-dim">
              {[experience.location, ...experience.sector].filter(Boolean).join(' · ')}
            </p>
            <p className="mb-3 text-sm text-text-muted md:text-[15px]">{experience.summary}</p>
            {experience.highlights.length > 0 && (
              <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted marker:text-brand-2-ink">
                {experience.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            )}
            {experience.technologies.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={t('stats.technologies')}>
                {experience.technologies.map((tech) => (
                  <li key={tech} className="chip">
                    {tech}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </MotionSection>
  );
}
