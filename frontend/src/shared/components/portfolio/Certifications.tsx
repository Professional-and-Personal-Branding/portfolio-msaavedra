import { Award } from 'lucide-react';
import { useLocale } from '@/shared/i18n/use-locale';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

export function Certifications({ data }: SectionProps) {
  const { t } = useLocale();

  return (
    <MotionSection
      id="certifications"
      aria-labelledby="certifications-title"
      className="mb-section"
    >
      <SectionHeading
        eyebrow={t('section.certifications.eyebrow')}
        title={t('section.certifications.title')}
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.certifications.map((item) => (
          <li key={item.id} className="surface flex items-center gap-3 px-4 py-3">
            <Award className="size-5 shrink-0 text-brand-2" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-text-dim">
                {[item.issuer, item.year].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </MotionSection>
  );
}
