import { ArrowUpRight, Award } from 'lucide-react';
import type { Locale } from '@/shared/i18n/locale';
import { useLocale } from '@/shared/i18n/use-locale';
import { certificationValidity } from '@/shared/lib/certification-validity';
import { formatMonthYear } from '@/shared/lib/format';
import { MotionSection } from '@/themes/motion-section';
import { SectionHeading } from './SectionHeading';
import type { SectionProps } from './types';

/** `2029-06` → `jun 2029`; con solo el año, el año. */
function formatExpiry(expiresAt: string, locale: Locale): string {
  return expiresAt.length === 4 ? expiresAt : formatMonthYear(`${expiresAt}-01`, locale);
}

export function Certifications({ data }: SectionProps) {
  const { t, locale } = useLocale();
  // La vigencia depende de la fecha del lector (decisión D5 de add-certification-verification).
  const now = new Date();

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
        {data.certifications.map((item) => {
          const validity = certificationValidity(item.expiresAt, now);
          const details = [
            item.credentialId ? `${t('certification.credentialId')}: ${item.credentialId}` : null,
            validity === 'valid' && item.expiresAt
              ? t('certification.validUntil').replace(
                  '{date}',
                  formatExpiry(item.expiresAt, locale),
                )
              : null,
            validity === 'expired' ? t('certification.expired') : null,
          ].filter(Boolean);
          return (
            <li key={item.id} className="surface flex items-center gap-3 px-4 py-3">
              <Award className="size-5 shrink-0 text-brand-2" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-text-dim">
                  {[item.issuer, item.year].filter(Boolean).join(' · ')}
                </p>
                {details.length > 0 && (
                  <p className="text-xs text-text-dim">{details.join(' · ')}</p>
                )}
                {item.verificationUrl && (
                  <a
                    href={item.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink hover:underline"
                  >
                    {t('certification.verify')}
                    <span className="sr-only">: {item.name}</span>
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </MotionSection>
  );
}
