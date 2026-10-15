import type { Locale } from '@/shared/i18n/locale';

/** Id de la pestaña de un idioma del conmutador de la vista previa; el panel lo usa en `aria-labelledby`. */
export const previewTabId = (panelId: string, locale: Locale) => `${panelId}-tab-${locale}`;
