import { useId, useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
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

type FieldLocale = 'es' | 'en';
const LOCALES: readonly FieldLocale[] = ['es', 'en'];

/**
 * Campo traducible con pestañas ES/EN sobre el mismo valor: `es` es
 * obligatorio y `en` opcional (spec `admin-content-management`).
 *
 * Cada pestaña controla un panel que existe en el DOM (`forceMount`, oculto con `hidden`
 * cuando no está activo), así `aria-controls` apunta a un id presente (spec
 * `web-accessibility` § Estructura semántica válida). Los dos controles conservan su valor
 * al cambiar de pestaña y la etiqueta sigue al que está activo.
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
  const [locale, setLocale] = useState<FieldLocale>('es');
  const id = useId();
  const Control = multiline ? Textarea : Input;

  return (
    <Tabs
      value={locale}
      onValueChange={(next) => setLocale(next as FieldLocale)}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-${locale}`}>
          {label}
          {required && <span className="text-brand-ink"> *</span>}
        </Label>
        <TabsList className="h-7">
          {LOCALES.map((code) => (
            <TabsTrigger key={code} value={code} className="px-2 py-0.5 text-xs uppercase">
              {code}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {LOCALES.map((code) => (
        // El panel no es un punto de tabulación propio: su único contenido es el control.
        <TabsContent
          key={code}
          value={code}
          forceMount
          hidden={locale !== code}
          tabIndex={-1}
          className="flex flex-col"
        >
          <Control
            id={`${id}-${code}`}
            aria-label={`${label} (${code})`}
            aria-invalid={error ? true : undefined}
            value={(code === 'es' ? value?.es : value?.en) ?? ''}
            rows={multiline ? 4 : undefined}
            onChange={(event: { target: { value: string } }) =>
              onChange({ ...value, es: value?.es ?? '', [code]: event.target.value })
            }
          />
        </TabsContent>
      ))}
      {description && !error && <p className="text-xs text-text-dim">{description}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger-ink">
          {error}
        </p>
      )}
    </Tabs>
  );
}
