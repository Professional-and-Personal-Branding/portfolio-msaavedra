import { Clock, Languages, Mail, MapPin, Phone } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/i18n/use-locale';
import { cn } from '@/shared/lib/utils';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

interface Row {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  href?: string;
}

export function Contact({ data, variant = 'default' }: SectionProps) {
  const { t } = useLocale();
  const profile = data.profile;
  if (!profile) return null;
  const compact = variant === 'compact';

  const rows: Row[] = [
    {
      icon: Mail,
      label: t('contact.email'),
      value: profile.email,
      href: `mailto:${profile.email}`,
    },
    ...(profile.phone
      ? [
          {
            icon: Phone,
            label: t('contact.phone'),
            value: profile.phone,
            href: `tel:${profile.phone}`,
          },
        ]
      : []),
    { icon: MapPin, label: t('contact.location'), value: profile.location },
    { icon: Clock, label: t('contact.timezone'), value: profile.timezone },
    ...(profile.languages.length > 0
      ? [
          {
            icon: Languages,
            label: t('contact.languages'),
            value: profile.languages.map((l) => `${l.name} · ${l.level}`).join(' / '),
          },
        ]
      : []),
  ];

  const availability = [
    [t('contact.modality'), profile.availability.modality],
    [t('contact.contractType'), profile.availability.contractType],
    [t('contact.startDate'), profile.availability.startDate],
  ] as const;

  return (
    <MotionSection
      id="contact"
      aria-labelledby="contact-title"
      className={cn(!compact && 'mb-section')}
    >
      {!compact && (
        <SectionHeading eyebrow={t('section.contact.eyebrow')} title={t('section.contact.title')} />
      )}
      <div className={cn('surface p-card', !compact && 'grid gap-8 md:grid-cols-2')}>
        <div className={cn(compact && 'mb-5')}>
          {/* El título va fuera del `dl`: un `dl` solo admite grupos `div > dt + dd` (spec `web-accessibility`). */}
          {compact && (
            <p className="mb-3 text-xs font-bold tracking-[0.15em] text-brand-ink uppercase">
              {t('section.contact.title')}
            </p>
          )}
          <dl className="flex flex-col gap-3">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="flex items-center gap-3 text-[11px] tracking-wide text-text-dim uppercase">
                  <row.icon className="size-4 shrink-0 text-brand" aria-hidden />
                  {row.label}
                </dt>
                <dd className="pl-7 text-sm break-words">
                  {row.href ? (
                    <a href={row.href} className="hover:text-brand-ink">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-3">
          <dl className="grid gap-2 text-sm">
            {availability.map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col rounded-theme-sm border border-border bg-bg-soft px-3 py-2"
              >
                <dt className="text-[11px] tracking-wide text-text-dim uppercase">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Button asChild size={compact ? 'sm' : 'lg'} className="mt-auto w-full sm:w-auto">
            <a href={`mailto:${profile.email}`}>
              <Mail aria-hidden />
              {t('contact.cta')}
            </a>
          </Button>
        </div>
      </div>
    </MotionSection>
  );
}
