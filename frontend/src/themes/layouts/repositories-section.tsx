import { Suspense } from 'react';
import { SectionHeading } from '@/shared/components/portfolio/SectionHeading';
import type { SectionProps } from '@/shared/components/portfolio/types';
import { useLocale } from '@/shared/i18n/use-locale';
import { LazyRepositories } from './lazy-repositories';

/** Mientras llega el chunk: el título y un alto reservado, sin spinner, para que nada se mueva. */
function RepositoriesPlaceholder() {
  const { t } = useLocale();
  return (
    <section id="repositories" aria-labelledby="repositories-title" className="mb-section min-h-80">
      <SectionHeading
        eyebrow={t('section.repositories.eyebrow')}
        title={t('section.repositories.title')}
      />
    </section>
  );
}

export function RepositoriesSection(props: SectionProps) {
  return (
    <Suspense fallback={<RepositoriesPlaceholder />}>
      <LazyRepositories {...props} />
    </Suspense>
  );
}
