import type { ComponentProps } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, 'id' | 'onChange'> {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  onValueChange: (value: string) => void;
}

/** Campo de texto con etiqueta, ayuda y error en línea, igual que los formularios del panel. */
export function TextField({
  id,
  label,
  required = false,
  error,
  description,
  onValueChange,
  ...inputProps
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-brand"> *</span>}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onValueChange(event.target.value)}
        {...inputProps}
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
