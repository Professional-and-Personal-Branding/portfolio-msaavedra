import type { MouseEvent } from 'react';
import { useLocale } from '@/shared/i18n/use-locale';

/** Id del `<main>` al que lleva el enlace; lo comparten la vista pública y el panel. */
export const MAIN_CONTENT_ID = 'contenido';

interface SkipLinkProps {
  /** Texto fijo (el panel está solo en español); sin él se traduce según el idioma activo. */
  label?: string;
}

/**
 * Enlace «Saltar al contenido» (spec `web-accessibility` § Salto al contenido y landmarks).
 * Oculto hasta recibir foco; tiene que ser el primer elemento enfocable de la pantalla y
 * apuntar a un `<main id={MAIN_CONTENT_ID} tabIndex={-1}>`, que es quien recibe el foco.
 */
export function SkipLink({ label }: SkipLinkProps) {
  const { t } = useLocale();

  // El foco va al `<main>` sin tocar la URL: el estado vive en `?lang= ?theme= ?layout=`.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    event.preventDefault();
    main.focus();
  };

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-theme-sm focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-foreground print:hidden"
    >
      {label ?? t('a11y.skipToContent')}
    </a>
  );
}
