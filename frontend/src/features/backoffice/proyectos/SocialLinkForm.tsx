import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import type { CreateSocialLinkBody } from '../shared/admin-types';
import { UnsavedChangesPrompt } from '../shared/UnsavedChangesPrompt';
import { useDialogDiscardGuard } from '../shared/use-dialog-discard-guard';
import { LocalizedField } from '../shared/fields/LocalizedField';
import {
  EMPTY_SOCIAL_LINK,
  isSocialLinkDirty,
  toSocialLinkBody,
  validateSocialLink,
  type SocialLinkFormValues,
} from './proyectos-form';
import { TextField } from './TextField';

interface SocialLinkFormProps {
  title: string;
  initialValues?: SocialLinkFormValues;
  saving: boolean;
  onSubmit: (body: CreateSocialLinkBody) => void;
  onOpenChange: (open: boolean) => void;
}

export function SocialLinkForm({
  title,
  initialValues,
  saving,
  onSubmit,
  onOpenChange,
}: SocialLinkFormProps) {
  const [values, setValues] = useState<SocialLinkFormValues>(initialValues ?? EMPTY_SOCIAL_LINK);
  const [initial] = useState<SocialLinkFormValues>(initialValues ?? EMPTY_SOCIAL_LINK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const guard = useDialogDiscardGuard({
    dirty: isSocialLinkDirty(values, initial),
    onClose: () => onOpenChange(false),
  });

  const set = <K extends keyof SocialLinkFormValues>(key: K, value: SocialLinkFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateSocialLink(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toSocialLinkBody(values));
  };

  return (
    <Dialog open onOpenChange={(next) => !next && guard.requestClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Los campos con * son obligatorios. Los enlaces destacados se muestran primero en la
            vista pública.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="link-platform"
              label="Plataforma"
              required
              placeholder="github"
              description="Minúsculas, dígitos y guiones: github, linkedin, youtube…"
              value={values.platform}
              error={errors.platform}
              onValueChange={(value) => set('platform', value)}
            />
            <TextField
              id="link-handle"
              label="Usuario"
              required
              placeholder="manuXD270516"
              value={values.handle}
              error={errors.handle}
              onValueChange={(value) => set('handle', value)}
            />
          </div>

          <TextField
            id="link-url"
            label="URL"
            required
            type="url"
            placeholder="https://github.com/usuario"
            value={values.url}
            error={errors.url}
            onValueChange={(value) => set('url', value)}
          />

          <LocalizedField
            label="Etiqueta"
            required
            value={values.label}
            error={errors.label}
            onChange={(value) => set('label', { es: value.es, en: value.en ?? '' })}
          />

          <LocalizedField
            label="Descripción"
            multiline
            description="Opcional."
            value={values.description}
            error={errors.description}
            onChange={(value) => set('description', { es: value.es, en: value.en ?? '' })}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-stats">Estadísticas (JSON)</Label>
            <Textarea
              id="link-stats"
              rows={4}
              className="font-mono text-xs"
              placeholder='{"repos": 67, "achievements": ["Pull Shark"]}'
              aria-invalid={errors.stats ? true : undefined}
              value={values.stats}
              onChange={(event) => set('stats', event.target.value)}
            />
            {errors.stats ? (
              <p role="alert" className="text-xs text-danger-ink">
                {errors.stats}
              </p>
            ) : (
              <p className="text-xs text-text-dim">
                Opcional. Un objeto JSON libre; dejalo vacío para quitarlas.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div className="w-28">
              <TextField
                id="link-order"
                label="Orden"
                type="number"
                min={0}
                value={values.order}
                error={errors.order}
                onValueChange={(value) => set('order', Number(value))}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="link-featured"
                checked={values.featured}
                onCheckedChange={(checked) => set('featured', checked)}
              />
              <Label htmlFor="link-featured">Destacado</Label>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="link-visible"
                checked={values.visible}
                onCheckedChange={(checked) => set('visible', checked)}
              />
              <Label htmlFor="link-visible">Visible en el portafolio</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={guard.requestClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
        <UnsavedChangesPrompt {...guard.promptProps} />
      </DialogContent>
    </Dialog>
  );
}
