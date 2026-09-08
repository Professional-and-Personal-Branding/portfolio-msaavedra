import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useLocale } from '@/shared/i18n/use-locale';

interface AccessTokenFormProps {
  invalid: boolean;
  onSubmit: (token: string) => void;
}

/** Formulario de token para perfiles PROTECTED (spec `public-portfolio-frontend`). */
export function AccessTokenForm({ invalid, onSubmit }: AccessTokenFormProps) {
  const { t } = useLocale();
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const token = value.trim();
    if (token) onSubmit(token);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-section text-center">
      <span className="mb-5 grid size-14 place-items-center rounded-full bg-brand-gradient text-brand-foreground">
        <KeyRound className="size-6" aria-hidden />
      </span>
      <h1 className="mb-2 text-2xl font-bold">{t('token.title')}</h1>
      <p className="mb-6 text-text-muted">{t('token.description')}</p>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
        <Input
          name="token"
          type="password"
          autoComplete="off"
          aria-label={t('token.placeholder')}
          aria-invalid={invalid || undefined}
          placeholder={t('token.placeholder')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
        <Button type="submit">{t('token.submit')}</Button>
      </form>
      {invalid && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t('token.invalid')}
        </p>
      )}
    </div>
  );
}
