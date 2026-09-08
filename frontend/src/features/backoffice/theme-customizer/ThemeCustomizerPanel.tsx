import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import type { Density, ThemeTokens } from '@/themes/tokens';
import type { AdminTheme } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { isHexColor, setToken } from './theme-draft';

const COLOR_FIELDS: { key: keyof ThemeTokens['colors']; label: string }[] = [
  { key: 'bg', label: 'Fondo' },
  { key: 'bgSoft', label: 'Fondo suave' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'border', label: 'Borde' },
  { key: 'text', label: 'Texto' },
  { key: 'textMuted', label: 'Texto tenue' },
  { key: 'accent', label: 'Acento' },
  { key: 'accent2', label: 'Acento 2' },
];

const FONTS = ['Inter', 'Poppins', 'Georgia', 'Playfair Display', 'JetBrains Mono'];
const DENSITIES: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compacta' },
  { value: 'comfortable', label: 'Cómoda' },
  { value: 'spacious', label: 'Amplia' },
];

interface ThemeCustomizerPanelProps {
  themes: AdminTheme[];
  themeId: string | null;
  tokens: ThemeTokens;
  hasOverrides: boolean;
  onThemeChange: (themeId: string) => void;
  onTokensChange: (tokens: ThemeTokens) => void;
  onReset: () => void;
}

/** Customizador con preview en tiempo real (spec `theme-customizer`). */
export function ThemeCustomizerPanel({
  themes,
  themeId,
  tokens,
  hasOverrides,
  onThemeChange,
  onTokensChange,
  onReset,
}: ThemeCustomizerPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="theme-base">Tema base</Label>
          <ThemeSelect
            themes={themes}
            value={themeId}
            hasOverrides={hasOverrides}
            onChange={onThemeChange}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={!hasOverrides}
        >
          <RotateCcw aria-hidden />
          Restablecer
        </Button>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-xs font-bold tracking-wide text-text-dim uppercase">
          Colores
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COLOR_FIELDS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={tokens.colors[field.key]}
              onChange={(value) => onTokensChange(setToken(tokens, 'colors', field.key, value))}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-xs font-bold tracking-wide text-text-dim uppercase">
          Tipografía y espaciado
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="font-sans">Fuente del cuerpo</Label>
          <Select
            value={tokens.typography.fontSans}
            onValueChange={(value) =>
              onTokensChange(setToken(tokens, 'typography', 'fontSans', value))
            }
          >
            <SelectTrigger id="font-sans" aria-label="Fuente del cuerpo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="font-heading">Fuente de títulos</Label>
          <Select
            value={tokens.typography.fontHeading}
            onValueChange={(value) =>
              onTokensChange(setToken(tokens, 'typography', 'fontHeading', value))
            }
          >
            <SelectTrigger id="font-heading" aria-label="Fuente de títulos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="density">Densidad</Label>
          <Select
            value={tokens.layout.density}
            onValueChange={(value) => onTokensChange(setToken(tokens, 'layout', 'density', value))}
          >
            <SelectTrigger id="density" aria-label="Densidad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DENSITIES.map((density) => (
                <SelectItem key={density.value} value={density.value}>
                  {density.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="radius">Radio de bordes</Label>
          <Input
            id="radius"
            value={tokens.layout.radius}
            onChange={(event) =>
              onTokensChange(setToken(tokens, 'layout', 'radius', event.target.value))
            }
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-6">
        <legend className="mb-1 text-xs font-bold tracking-wide text-text-dim uppercase">
          Modo y efectos
        </legend>
        <div className="flex items-center gap-2">
          <Switch
            id="mode"
            checked={tokens.mode === 'dark'}
            onCheckedChange={(checked) =>
              onTokensChange(setToken(tokens, 'mode', 'mode', checked ? 'dark' : 'light'))
            }
          />
          <Label htmlFor="mode">Modo oscuro</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="animations"
            checked={tokens.effects.animations}
            onCheckedChange={(checked) =>
              onTokensChange(setToken(tokens, 'effects', 'animations', checked))
            }
          />
          <Label htmlFor="animations">Animaciones</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="glass"
            checked={tokens.effects.glassmorphism}
            onCheckedChange={(checked) =>
              onTokensChange(setToken(tokens, 'effects', 'glassmorphism', checked))
            }
          />
          <Label htmlFor="glass">Glassmorphism</Label>
        </div>
      </fieldset>
    </div>
  );
}

function ThemeSelect({
  themes,
  value,
  hasOverrides,
  onChange,
}: {
  themes: AdminTheme[];
  value: string | null;
  hasOverrides: boolean;
  onChange: (id: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);

  const select = (id: string) => {
    if (hasOverrides && id !== value) setPending(id);
    else onChange(id);
  };

  return (
    <>
      <Select value={value ?? ''} onValueChange={select}>
        <SelectTrigger id="theme-base" aria-label="Tema base">
          <SelectValue placeholder="Tema por defecto" />
        </SelectTrigger>
        <SelectContent>
          {themes.map((theme) => (
            <SelectItem key={theme.id} value={theme.id}>
              {theme.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Cambiar el tema base"
        description="Los ajustes de color, tipografía y espaciado que hiciste sobre el tema actual se perderán."
        confirmLabel="Cambiar tema"
        onConfirm={() => {
          if (pending) onChange(pending);
          setPending(null);
        }}
      />
    </>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const [dirty, setDirty] = useState(false);
  const shown = dirty ? text : value;
  const invalid = !isHexColor(shown);

  const apply = (next: string) => {
    setText(next);
    setDirty(true);
    if (isHexColor(next)) onChange(next.trim());
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={label}
        value={isHexColor(value) ? value : '#000000'}
        onChange={(event) => {
          setDirty(false);
          onChange(event.target.value);
        }}
        className="size-9 shrink-0 cursor-pointer rounded-theme-sm border border-border bg-transparent"
      />
      <div className="min-w-0 flex-1">
        <Label className="text-xs text-text-dim">{label}</Label>
        <Input
          aria-label={`${label} en hexadecimal`}
          aria-invalid={invalid || undefined}
          value={shown}
          onChange={(event) => apply(event.target.value)}
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );
}
