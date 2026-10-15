import { useLocale } from '@/shared/i18n/use-locale';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

export function SkillsGrid({ data }: SectionProps) {
  const { t } = useLocale();

  return (
    <MotionSection id="skills" aria-labelledby="skills-title" className="mb-section">
      <SectionHeading eyebrow={t('section.skills.eyebrow')} title={t('section.skills.title')} />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.skillCategories.map((category) => (
          <li
            key={category.name}
            className="surface p-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-brand-2"
          >
            <h3 className="mb-3 text-[15px] font-bold text-brand-2-ink">{category.name}</h3>
            <ul className="flex flex-wrap gap-1.5">
              {category.skills.map((skill) => (
                <li key={skill} className="chip hover:border-brand hover:text-text">
                  {skill}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </MotionSection>
  );
}
