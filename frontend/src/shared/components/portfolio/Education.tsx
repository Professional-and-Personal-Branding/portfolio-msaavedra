import { GraduationCap } from 'lucide-react';
import { useLocale } from '@/shared/i18n/use-locale';
import { formatPeriod } from '@/shared/lib/format';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

export function Education({ data }: SectionProps) {
  const { t, locale } = useLocale();

  return (
    <MotionSection id="education" aria-labelledby="education-title" className="mb-section">
      <SectionHeading
        eyebrow={t('section.education.eyebrow')}
        title={t('section.education.title')}
      />
      <ul className="flex flex-col gap-3">
        {data.education.map((item) => (
          <li key={item.id} className="surface flex items-start gap-4 p-card">
            <span className="grid size-10 shrink-0 place-items-center rounded-theme-sm border border-border bg-bg-soft text-brand-ink">
              <GraduationCap className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">
                {item.degree}
                {item.inProgress && (
                  <span className="ml-2 inline-block rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 align-middle text-[11px] font-medium text-brand-ink">
                    {t('education.inProgress')}
                  </span>
                )}
              </h3>
              <p className="text-sm text-text-muted">{item.institution}</p>
              <p className="mt-1 text-xs text-text-dim">
                {formatPeriod(item.startDate, item.endDate, locale, t('experience.present'))}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </MotionSection>
  );
}
