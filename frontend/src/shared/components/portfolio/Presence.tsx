import { ArrowUpRight } from 'lucide-react';
import { useLocale } from '@/shared/i18n/use-locale';
import { formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { SocialLink } from '@/shared/types/portfolio';
import { MotionSection } from '@/themes/motion-section';
import { BrandIcon } from './BrandIcon';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

/** Presencia pública: enlaces `featured` protagonistas, el resto en tiras (demo.html). */
export function Presence({ data }: SectionProps) {
  const { t } = useLocale();
  const featured = data.socialLinks.filter((link) => link.featured);
  const rest = data.socialLinks.filter((link) => !link.featured);

  return (
    <MotionSection id="presence" aria-labelledby="presence-title" className="mb-section">
      <SectionHeading eyebrow={t('section.presence.eyebrow')} title={t('section.presence.title')} />
      {featured.length > 0 && (
        <ul className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {featured.map((link) => (
            <li key={link.id}>
              <PresenceCard link={link} featured />
            </li>
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rest.map((link) => (
            <li key={link.id}>
              <PresenceCard link={link} />
            </li>
          ))}
        </ul>
      )}
    </MotionSection>
  );
}

function PresenceCard({ link, featured = false }: { link: SocialLink; featured?: boolean }) {
  const { t, locale } = useLocale();
  const stats = statsOf(link.stats);

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'group surface block transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-brand hover:glow-brand',
        featured ? 'p-card' : 'border-dashed bg-bg-soft px-5 py-4',
      )}
    >
      <div className={cn('flex items-center gap-3', featured && 'mb-3')}>
        <span className="grid size-10 shrink-0 place-items-center rounded-theme-sm border border-border bg-bg-soft">
          <BrandIcon platform={link.platform} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={cn('font-bold leading-tight', featured ? 'text-lg' : 'text-sm')}>
            {link.label}
          </h3>
          <p className="truncate font-mono text-xs text-text-dim">{link.handle}</p>
        </div>
        <ArrowUpRight
          className="size-5 shrink-0 text-text-dim transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-ink"
          aria-hidden
        />
      </div>
      {featured && link.description && (
        <p className="mb-4 text-sm text-text-muted">{link.description}</p>
      )}
      {featured && (stats.numbers.length > 0 || stats.badges.length > 0) && (
        <ul className="flex flex-wrap gap-2">
          {stats.numbers.map(([key, value]) => (
            <li
              key={key}
              className="flex min-w-16 flex-col items-center rounded-theme-sm border border-border bg-bg-soft px-3 py-1.5"
            >
              <strong className="text-lg font-extrabold text-gradient">
                {formatNumber(value, locale)}
              </strong>
              <span className="text-[11px] text-text-dim">{labelFor(key, t)}</span>
            </li>
          ))}
          {stats.badges.map((badge) => (
            <li
              key={badge}
              className="flex items-center rounded-theme-sm border border-border bg-bg-soft px-3 text-xs text-text-muted"
            >
              {badge}
            </li>
          ))}
        </ul>
      )}
    </a>
  );
}

type Translate = ReturnType<typeof useLocale>['t'];

function labelFor(key: string, t: Translate): string {
  if (key === 'repos') return t('presence.repos');
  if (key === 'followers') return t('presence.followers');
  return key;
}

/** `stats` es JSON libre: números → pills, listas de strings → badges. */
function statsOf(stats: unknown): { numbers: [string, number][]; badges: string[] } {
  const numbers: [string, number][] = [];
  const badges: string[] = [];
  if (stats && typeof stats === 'object') {
    for (const [key, value] of Object.entries(stats as Record<string, unknown>)) {
      if (typeof value === 'number') numbers.push([key, value]);
      else if (Array.isArray(value)) {
        for (const item of value) if (typeof item === 'string') badges.push(item);
      }
    }
  }
  return { numbers, badges };
}
