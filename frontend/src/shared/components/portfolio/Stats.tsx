import { useLocale } from '@/shared/i18n/use-locale';
import { formatNumber } from '@/shared/lib/format';
import { computeStats } from '@/shared/lib/stats';
import { MotionSection } from '@/themes/motion-section';
import type { SectionProps } from './types';

export function Stats({ data }: SectionProps) {
  const { t, locale } = useLocale();
  const stats = computeStats(data);
  const items = [
    { label: t('stats.years'), value: `${stats.years}+` },
    { label: t('stats.experiences'), value: formatNumber(stats.experiences, locale) },
    { label: t('stats.technologies'), value: formatNumber(stats.technologies, locale) },
    { label: t('stats.certifications'), value: formatNumber(stats.certifications, locale) },
  ];

  return (
    <MotionSection id="stats" aria-label={t('stats.experiences')} className="mb-section">
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item) => (
          <li
            key={item.label}
            className="surface p-card text-center transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-brand hover:glow-brand"
          >
            <p className="text-4xl font-extrabold text-gradient">{item.value}</p>
            <p className="mt-1 text-xs text-text-dim">{item.label}</p>
          </li>
        ))}
      </ul>
    </MotionSection>
  );
}
