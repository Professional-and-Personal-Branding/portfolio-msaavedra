import { useId, useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import type { LocalizedText } from '../admin-types';

export interface LocalizedFieldProps {
  label: string;
  value: LocalizedText | undefined;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
  required?: boolean;
  error?: string;
  description?: string;
}

/**
 * Campo traducible con pestañas ES/EN sobre el mismo valor: `es` es
 * obligatorio y `en` opcional (spec `admin-content-management`).
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  error,
  description,
}: LocalizedFieldProps) {
  const [locale, setLocale] = useState<'es' | 'en'>('es');
  const id = useId();
  const current = (locale === 'es' ? value?.es : value?.en) ?? '';
  const Control = multiline ? Textarea : Input;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-brand"> *</span>}
        </Label>
        <Tabs value={locale} onValueChange={(next) => setLocale(next as 'es' | 'en')}>
          <TabsList className="h-7">
            <TabsTrigger value="es" className="px-2 py-0.5 text-xs uppercase">
              es
            </TabsTrigger>
            <TabsTrigger value="en" className="px-2 py-0.5 text-xs uppercase">
              en
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Control
        id={id}
        aria-label={`${label} (${locale})`}
        aria-invalid={error ? true : undefined}
        value={current}
        rows={multiline ? 4 : undefined}
        onChange={(event: { target: { value: string } }) =>
          onChange({ ...value, es: value?.es ?? '', [locale]: event.target.value })
        }
      />
      {description && !error && <p className="text-xs text-text-dim">{description}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
