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
import type { CreateProjectBody } from '../shared/admin-types';
import { UnsavedChangesPrompt } from '../shared/UnsavedChangesPrompt';
import { useDialogDiscardGuard } from '../shared/use-dialog-discard-guard';
import { ChipListField } from '../shared/fields/ChipListField';
import { LocalizedField } from '../shared/fields/LocalizedField';
import {
  EMPTY_PROJECT,
  toProjectBody,
  validateProject,
  type ProjectFormValues,
} from './proyectos-form';
import { TextField } from './TextField';

interface ProjectFormProps {
  title: string;
  initialValues?: ProjectFormValues;
  saving: boolean;
  onSubmit: (body: CreateProjectBody) => void;
  onOpenChange: (open: boolean) => void;
}

export function ProjectForm({
  title,
  initialValues,
  saving,
  onSubmit,
  onOpenChange,
}: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(initialValues ?? EMPTY_PROJECT);
  const [initial] = useState<ProjectFormValues>(initialValues ?? EMPTY_PROJECT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const guard = useDialogDiscardGuard({
    dirty: JSON.stringify(toProjectBody(values)) !== JSON.stringify(toProjectBody(initial)),
    onClose: () => onOpenChange(false),
  });

  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateProject(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toProjectBody(values));
  };

  return (
    <Dialog open onOpenChange={(next) => !next && guard.requestClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Los campos con * son obligatorios. Los tags deciden en qué perfiles curados aparece el
            proyecto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <TextField
                id="project-name"
                label="Nombre"
                required
                value={values.name}
                error={errors.name}
                onValueChange={(value) => set('name', value)}
              />
            </div>
            <TextField
              id="project-period"
              label="Período"
              required
              placeholder="2019-2020"
              value={values.period}
              error={errors.period}
              onValueChange={(value) => set('period', value)}
            />
          </div>

          <LocalizedField
            label="Rol"
            required
            value={values.role}
            error={errors.role}
            onChange={(value) => set('role', { es: value.es, en: value.en ?? '' })}
          />

          <TextField
            id="project-url"
            label="URL"
            type="url"
            placeholder="https://github.com/usuario/proyecto"
            description="Opcional. Dejala vacía para quitar el enlace."
            value={values.url}
            error={errors.url}
            onValueChange={(value) => set('url', value)}
          />

          <LocalizedField
            label="Resumen"
            required
            multiline
            value={values.summary}
            error={errors.summary}
            onChange={(value) => set('summary', { es: value.es, en: value.en ?? '' })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChipListField
              label="Tecnologías"
              value={values.technologies}
              placeholder="React"
              onChange={(items) => set('technologies', items)}
            />
            <ChipListField
              label="Tags"
              value={values.tags}
              placeholder="nodejs"
              description="Deciden en qué perfiles curados aparece este proyecto."
              onChange={(items) => set('tags', items)}
            />
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div className="w-28">
              <TextField
                id="project-order"
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
                id="project-visible"
                checked={values.visible}
                onCheckedChange={(checked) => set('visible', checked)}
              />
              <Label htmlFor="project-visible">Visible en el portafolio</Label>
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
