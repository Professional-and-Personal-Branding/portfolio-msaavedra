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
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { ChipListField } from '../shared/fields/ChipListField';
import { LocalizedField } from '../shared/fields/LocalizedField';
import {
  EMPTY_EXPERIENCE,
  toExperienceBody,
  validateExperience,
  type ExperienceFormValues,
} from './experience-form';
import type { CreateExperienceBody } from '../shared/admin-types';
import { UnsavedChangesPrompt } from '../shared/UnsavedChangesPrompt';
import { useDialogDiscardGuard } from '../shared/use-dialog-discard-guard';

interface ExperienceFormProps {
  open: boolean;
  initialValues?: ExperienceFormValues;
  title: string;
  saving: boolean;
  onSubmit: (body: CreateExperienceBody) => void;
  onOpenChange: (open: boolean) => void;
}

export function ExperienceForm({
  open,
  initialValues,
  title,
  saving,
  onSubmit,
  onOpenChange,
}: ExperienceFormProps) {
  const [values, setValues] = useState<ExperienceFormValues>(initialValues ?? EMPTY_EXPERIENCE);
  const [initial] = useState<ExperienceFormValues>(initialValues ?? EMPTY_EXPERIENCE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const guard = useDialogDiscardGuard({
    dirty: JSON.stringify(toExperienceBody(values)) !== JSON.stringify(toExperienceBody(initial)),
    onClose: () => onOpenChange(false),
  });

  const set = <K extends keyof ExperienceFormValues>(key: K, value: ExperienceFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateExperience(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toExperienceBody(values));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && guard.requestClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Los campos con * son obligatorios. La traducción al inglés es opcional: si falta, la
            vista pública en inglés muestra el texto en español.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">
                Empresa<span className="text-brand-ink"> *</span>
              </Label>
              <Input
                id="company"
                value={values.company}
                aria-invalid={errors.company ? true : undefined}
                onChange={(event) => set('company', event.target.value)}
              />
              {errors.company && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.company}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">
                Ubicación<span className="text-brand-ink"> *</span>
              </Label>
              <Input
                id="location"
                value={values.location}
                aria-invalid={errors.location ? true : undefined}
                onChange={(event) => set('location', event.target.value)}
              />
              {errors.location && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.location}
                </p>
              )}
            </div>
          </div>

          <LocalizedField
            label="Rol"
            required
            value={values.role}
            error={errors.role}
            onChange={(value) => set('role', { es: value.es, en: value.en ?? '' })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">
                Inicio<span className="text-brand-ink"> *</span>
              </Label>
              <Input
                id="startDate"
                type="month"
                value={values.startDate}
                aria-invalid={errors.startDate ? true : undefined}
                onChange={(event) => set('startDate', event.target.value)}
              />
              {errors.startDate && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.startDate}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">Fin</Label>
              <Input
                id="endDate"
                type="month"
                disabled={values.current}
                value={values.endDate ?? ''}
                onChange={(event) => set('endDate', event.target.value || null)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="order">Orden</Label>
              <Input
                id="order"
                type="number"
                min={0}
                value={values.order}
                onChange={(event) => set('order', Number(event.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="current"
                checked={values.current}
                onCheckedChange={(checked) => {
                  set('current', checked);
                  if (checked) set('endDate', null);
                }}
              />
              <Label htmlFor="current">Actual</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="visible"
                checked={values.visible}
                onCheckedChange={(checked) => set('visible', checked)}
              />
              <Label htmlFor="visible">Visible en el portafolio</Label>
            </div>
          </div>

          <LocalizedField
            label="Resumen"
            required
            multiline
            value={values.summary}
            error={errors.summary}
            onChange={(value) => set('summary', { es: value.es, en: value.en ?? '' })}
          />

          <ChipListField
            label="Logros (es)"
            multiline
            value={values.highlights.es}
            placeholder="Agregar un logro"
            onChange={(items) => set('highlights', { ...values.highlights, es: items })}
          />

          <ChipListField
            label="Logros (en)"
            multiline
            value={values.highlights.en ?? []}
            placeholder="Add an achievement"
            onChange={(items) => set('highlights', { ...values.highlights, en: items })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ChipListField
              label="Tecnologías"
              value={values.technologies}
              placeholder="React"
              onChange={(items) => set('technologies', items)}
            />
            <ChipListField
              label="Tags"
              value={values.tags}
              placeholder="dotnet"
              onChange={(items) => set('tags', items)}
            />
            <ChipListField
              label="Sector"
              value={values.sector}
              placeholder="fintech"
              onChange={(items) => set('sector', items)}
            />
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
