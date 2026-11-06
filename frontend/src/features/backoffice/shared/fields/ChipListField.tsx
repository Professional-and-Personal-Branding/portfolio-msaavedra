import { Plus, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';

export interface ChipListFieldProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Elementos largos (por ejemplo `highlights`): se editan como filas de texto. */
  multiline?: boolean;
  description?: string;
}

/**
 * Lista de valores que se agregan y se quitan de a uno, sin pedirle al usuario
 * separadores ni JSON (spec `admin-content-management` § Campos bilingües y listas).
 */
export function ChipListField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  description,
}: ChipListFieldProps) {
  const [draft, setDraft] = useState('');
  const id = useId();

  const add = () => {
    const item = draft.trim();
    if (!item || value.includes(item)) {
      setDraft('');
      return;
    }
    onChange([...value, item]);
    setDraft('');
  };

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));
  const updateAt = (index: number, item: string) =>
    onChange(value.map((current, i) => (i === index ? item : current)));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>

      {multiline ? (
        <ul className="flex flex-col gap-2">
          {value.map((item, index) => (
            <li key={`${index}-${item.slice(0, 12)}`} className="flex items-start gap-2">
              <Textarea
                aria-label={`${label} ${index + 1}`}
                value={item}
                rows={2}
                onChange={(event) => updateAt(index, event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Quitar ${label} ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        value.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {value.map((item, index) => (
              <li key={item} className="chip gap-1 pr-1">
                {item}
                <button
                  type="button"
                  aria-label={`Quitar ${item}`}
                  onClick={() => removeAt(index)}
                  className="rounded-full p-0.5 hover:text-danger-ink"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      <div className="flex items-start gap-2">
        {multiline ? (
          <Textarea
            id={id}
            rows={2}
            placeholder={placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : (
          <Input
            id={id}
            placeholder={placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Agregar ${label}`}
          onClick={add}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {description && <p className="text-xs text-text-dim">{description}</p>}
    </div>
  );
}
