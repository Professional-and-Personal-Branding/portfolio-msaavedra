import { Printer } from 'lucide-react';
import { useLocale } from '@/shared/i18n/use-locale';

interface PrintButtonProps {
  onPrint: () => void;
}

/**
 * "Imprimir / Guardar PDF" (decisión D9): el texto se ve desde `md`; en móvil queda el
 * icono, y el `aria-label` lo nombra en los dos casos. La barra que lo contiene no se imprime.
 */
export function PrintButton({ onPrint }: PrintButtonProps) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onPrint}
      aria-label={t('print.button')}
      className="flex items-center gap-1.5 rounded-theme-sm border border-border px-2.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:text-text"
    >
      <Printer className="size-4" aria-hidden />
      <span className="hidden md:inline">{t('print.button')}</span>
    </button>
  );
}
