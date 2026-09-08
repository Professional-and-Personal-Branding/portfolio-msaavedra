import { useLocale } from '@/shared/i18n/use-locale';

interface FooterProps {
  name?: string | null;
}

export function Footer({ name }: FooterProps) {
  const { t } = useLocale();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-section border-t border-border py-10 text-center text-sm text-text-dim">
      <p>{t('footer.note')}</p>
      {name && (
        <p className="mt-1">
          © {year} {name}
        </p>
      )}
    </footer>
  );
}
