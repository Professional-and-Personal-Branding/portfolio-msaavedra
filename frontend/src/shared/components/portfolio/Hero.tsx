import { Briefcase, Clock, Mail, MapPin } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/i18n/use-locale';
import { cn } from '@/shared/lib/utils';
import { BrandIcon } from './BrandIcon';
import type { SectionProps } from './types';

/**
 * Hero: badge de disponibilidad, nombre, headline curado, resumen y metadatos (demo.html).
 * Sin fundido de entrada: contiene el LCP y tiene que pintarse con opacidad completa desde el
 * primer frame (spec web-performance § El contenido principal no espera animaciones).
 */
export function Hero({ data, variant = 'default' }: SectionProps) {
  const { t } = useLocale();
  const profile = data.profile;
  if (!profile) return null;

  const compact = variant === 'compact';
  const linkedin = data.socialLinks.find((link) => link.platform.toLowerCase() === 'linkedin');
  const headline = data.headline || profile.headline;

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className={cn(compact ? 'surface p-card' : 'pt-16 pb-10 md:pt-20')}
    >
      <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-medium text-brand-ink">
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-success shadow-[0_0_8px] shadow-success"
        />
        {t('hero.available')} · {profile.availability.startDate}
      </span>

      <h1
        id="hero-title"
        className={cn(
          'mb-3 font-extrabold tracking-tight text-balance',
          compact
            ? 'text-2xl leading-tight'
            : 'bg-linear-to-br from-text to-text-muted bg-clip-text text-4xl leading-[1.05] text-transparent md:text-6xl',
        )}
      >
        {profile.fullName}
      </h1>
      <p
        className={cn(
          'mb-4 font-semibold text-brand-ink',
          compact ? 'text-base' : 'text-xl md:text-2xl',
        )}
      >
        {headline}
      </p>
      {!compact && data.description && data.slug !== 'all' && (
        <p className="mb-3 max-w-2xl text-base text-text-muted">{data.description}</p>
      )}
      <p className={cn('max-w-3xl text-text-muted', compact ? 'mb-5 text-sm' : 'mb-7 text-lg')}>
        {profile.summary}
      </p>

      <ul
        className={cn(
          'mb-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-dim',
          compact && 'flex-col gap-y-2',
        )}
      >
        <li className="flex items-center gap-2">
          <MapPin className="size-4 text-brand" aria-hidden />
          {profile.location}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-4 text-brand" aria-hidden />
          {profile.timezone}
        </li>
        <li className="flex items-center gap-2">
          <Briefcase className="size-4 text-brand" aria-hidden />
          {profile.yearsOfExperience}+ {t('hero.years')}
        </li>
        <li className="flex items-center gap-2">
          <Mail className="size-4 text-brand" aria-hidden />
          <a href={`mailto:${profile.email}`} className="hover:text-text">
            {profile.email}
          </a>
        </li>
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button asChild size={compact ? 'sm' : 'lg'}>
          <a href={`mailto:${profile.email}`}>
            <Mail aria-hidden />
            {t('hero.contact')}
          </a>
        </Button>
        {linkedin && (
          <Button asChild variant="outline" size={compact ? 'sm' : 'lg'}>
            <a href={linkedin.url} target="_blank" rel="noreferrer">
              <BrandIcon platform="linkedin" className="size-4" />
              {t('hero.linkedin')}
            </a>
          </Button>
        )}
      </div>
    </section>
  );
}
