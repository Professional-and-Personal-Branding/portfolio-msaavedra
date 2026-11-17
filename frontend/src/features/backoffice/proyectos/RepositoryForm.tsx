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
import type { AdminRepository, CreateRepositoryBody } from '../shared/admin-types';
import { UnsavedChangesPrompt } from '../shared/UnsavedChangesPrompt';
import { useDialogDiscardGuard } from '../shared/use-dialog-discard-guard';
import { ChipListField } from '../shared/fields/ChipListField';
import { LocalizedField } from '../shared/fields/LocalizedField';
import {
  DUPLICATE_REPOSITORY_MESSAGE,
  EMPTY_REPOSITORY,
  proposedRepositoryName,
  toRepositoryBody,
  validateRepository,
  type RepositoryFormValues,
} from './proyectos-form';
import { TextField } from './TextField';

interface RepositoryFormProps {
  title: string;
  initialValues?: RepositoryFormValues;
  /** Lo verificado contra GitHub (solo lectura): descripción de referencia y lenguaje de respaldo. */
  evidence?: AdminRepository['evidence'];
  saving: boolean;
  /** URL que el servidor rechazó por repetida (409): mientras no se edite, el error va en el campo. */
  conflictUrl?: string | null;
  onSubmit: (body: CreateRepositoryBody) => void;
  onOpenChange: (open: boolean) => void;
}

export function RepositoryForm({
  title,
  initialValues,
  evidence,
  saving,
  conflictUrl,
  onSubmit,
  onOpenChange,
}: RepositoryFormProps) {
  const [values, setValues] = useState<RepositoryFormValues>(initialValues ?? EMPTY_REPOSITORY);
  const [initial] = useState<RepositoryFormValues>(initialValues ?? EMPTY_REPOSITORY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const guard = useDialogDiscardGuard({
    dirty: JSON.stringify(toRepositoryBody(values)) !== JSON.stringify(toRepositoryBody(initial)),
    onClose: () => onOpenChange(false),
  });

  const set = <K extends keyof RepositoryFormValues>(key: K, value: RepositoryFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  /** Al salir de la URL, si es válida y el nombre está vacío, propone el segmento `repo`. */
  const proposeName = () => {
    if (values.name.trim() === '') {
      const proposed = proposedRepositoryName(values.url);
      if (proposed) set('name', proposed);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateRepository(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toRepositoryBody(values));
  };

  const duplicate =
    conflictUrl && conflictUrl === values.url.trim() ? DUPLICATE_REPOSITORY_MESSAGE : undefined;
  // La evidencia de un repositorio con la URL cambiada (`stale`) no describe lo que se edita.
  const usableEvidence = evidence && !evidence.stale ? evidence : null;
  const githubLanguage = usableEvidence?.primaryLanguage ?? null;
  const githubDescription = usableEvidence?.githubDescription ?? null;

  return (
    <Dialog open onOpenChange={(next) => !next && guard.requestClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Los campos con * son obligatorios. Los tags deciden en qué perfiles curados aparece el
            repositorio; la sección se muestra desde 2 repositorios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            id="repository-url"
            label="URL de GitHub"
            required
            placeholder="https://github.com/usuario/repositorio"
            description="Solo repositorios de github.com, con esa forma exacta."
            value={values.url}
            error={errors.url ?? duplicate}
            onValueChange={(value) => set('url', value)}
            onBlur={proposeName}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <TextField
                id="repository-name"
                label="Nombre"
                required
                value={values.name}
                error={errors.name}
                onValueChange={(value) => set('name', value)}
              />
            </div>
            <TextField
              id="repository-language"
              label="Lenguaje"
              placeholder={githubLanguage ? `De GitHub: ${githubLanguage}` : 'TypeScript'}
              description="Opcional. Si lo dejás vacío se usa el lenguaje verificado en GitHub."
              value={values.language}
              error={errors.language}
              onValueChange={(value) => set('language', value)}
            />
          </div>

          <LocalizedField
            label="Descripción"
            required
            multiline
            value={values.description}
            error={errors.description}
            onChange={(value) => set('description', { es: value.es, en: value.en ?? '' })}
          />
          {githubDescription && (
            <p className="-mt-2 text-xs text-text-muted">
              <span className="font-medium">Descripción en GitHub:</span> {githubDescription}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChipListField
              label="Tecnologías"
              value={values.technologies}
              placeholder="NestJS"
              onChange={(items) => set('technologies', items)}
            />
            <ChipListField
              label="Tags"
              value={values.tags}
              placeholder="nodejs"
              description="Deciden en qué perfiles curados aparece este repositorio."
              onChange={(items) => set('tags', items)}
            />
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div className="w-28">
              <TextField
                id="repository-order"
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
                id="repository-visible"
                checked={values.visible}
                onCheckedChange={(checked) => set('visible', checked)}
              />
              <Label htmlFor="repository-visible">Visible en el sitio</Label>
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
