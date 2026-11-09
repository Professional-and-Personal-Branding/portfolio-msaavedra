import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { Textarea } from '@/shared/components/ui/textarea';
import type { Application, CreateApplicationBody } from '../shared/admin-types';
import { UnsavedChangesPrompt } from '../shared/UnsavedChangesPrompt';
import { useDialogDiscardGuard } from '../shared/use-dialog-discard-guard';
import { useCuratedProfilesAdmin, useShareLinks } from '../shared/use-admin-api';
import {
  createApplicationSchema,
  EMPTY_APPLICATION,
  toApplicationBody,
  toApplicationValues,
  type ApplicationFormValues,
} from './application-form';
import { APPLICATION_STATUSES, localToday, STATUS_LABELS } from './application-status';

interface ApplicationDialogProps {
  /** La postulación que se edita; sin ella, el diálogo crea una. */
  application?: Application;
  saving: boolean;
  /** Mensaje de la API (422, 409…) que el diálogo muestra sin cerrarse. */
  apiError: string | null;
  onSubmit: (body: CreateApplicationBody) => void;
  onOpenChange: (open: boolean) => void;
}

const SELECT_CLASS =
  'h-9 w-full rounded-theme-sm border border-border bg-bg px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Alta y edición de una postulación (D11 de `add-application-tracking`). React Hook Form + Zod con
 * las reglas del servidor; al editar, el selector de estado ofrece solo el actual y los
 * `nextStatuses` que manda la API (sin copiar la tabla de transiciones en el cliente).
 */
export function ApplicationDialog({
  application,
  saving,
  apiError,
  onSubmit,
  onOpenChange,
}: ApplicationDialogProps) {
  const today = useMemo(() => localToday(), []);
  const schema = useMemo(() => createApplicationSchema(today), [today]);
  const initial = useMemo(
    () => (application ? toApplicationValues(application) : EMPTY_APPLICATION),
    [application],
  );
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });
  const guard = useDialogDiscardGuard({ dirty: isDirty, onClose: () => onOpenChange(false) });

  const status = useWatch({ control, name: 'status' });
  const profileId = useWatch({ control, name: 'curatedProfileId' });

  const profiles = useCuratedProfilesAdmin();
  const links = useShareLinks(profileId === '' ? undefined : profileId);

  const statuses = application
    ? [application.status, ...application.nextStatuses]
    : APPLICATION_STATUSES;

  // Los enlaces `MANUAL` del perfil elegido; el propio de la postulación siempre figura aunque
  // la lista todavía no haya llegado.
  const manualLinks = (links.data ?? [])
    .filter((link) => link.kind === 'MANUAL')
    .map((link) => ({
      id: link.id,
      label: link.label,
      portal: link.portal,
      revoked: !!link.revokedAt,
    }));
  const own = application?.shareLink;
  if (
    own &&
    profileId === application?.curatedProfileId &&
    !manualLinks.some((l) => l.id === own.id)
  ) {
    manualLinks.push({ id: own.id, label: own.label, portal: null, revoked: own.revoked });
  }

  const statusField = register('status', {
    onChange: (event: { target: { value: string } }) => {
      const next = event.target.value;
      if (next === 'DRAFT') setValue('appliedAt', '', { shouldDirty: true });
      else if (getValues('appliedAt') === '') setValue('appliedAt', today, { shouldDirty: true });
    },
  });
  const profileField = register('curatedProfileId', {
    onChange: () => setValue('shareLinkId', '', { shouldDirty: true }),
  });
  const linkField = register('shareLinkId', {
    onChange: (event: { target: { value: string } }) => {
      const chosen = manualLinks.find((link) => link.id === event.target.value);
      if (chosen?.portal && getValues('portal').trim() === '') {
        setValue('portal', chosen.portal, { shouldDirty: true });
      }
    },
  });

  const submit = handleSubmit((values) => onSubmit(toApplicationBody(values)));

  return (
    <Dialog open onOpenChange={(next) => !next && guard.requestClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{application ? 'Editar postulación' : 'Nueva postulación'}</DialogTitle>
          <DialogDescription>
            Los campos con * son obligatorios. Es un registro tuyo: nada de esto se publica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="app-company" label="Empresa" required error={errors.company?.message}>
              <Input
                id="app-company"
                aria-invalid={errors.company ? true : undefined}
                aria-describedby={errors.company ? 'app-company-error' : undefined}
                {...register('company')}
              />
            </Field>
            <Field id="app-role" label="Puesto" required error={errors.role?.message}>
              <Input
                id="app-role"
                aria-invalid={errors.role ? true : undefined}
                aria-describedby={errors.role ? 'app-role-error' : undefined}
                {...register('role')}
              />
            </Field>
          </div>

          <Field id="app-jobUrl" label="URL de la vacante" error={errors.jobUrl?.message}>
            <Input
              id="app-jobUrl"
              inputMode="url"
              placeholder="https://empresa.example/jobs/1"
              aria-invalid={errors.jobUrl ? true : undefined}
              aria-describedby={errors.jobUrl ? 'app-jobUrl-error' : undefined}
              {...register('jobUrl')}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="app-status" label="Estado">
              <select id="app-status" className={SELECT_CLASS} {...statusField}>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            {status !== 'DRAFT' && (
              <Field
                id="app-appliedAt"
                label="Fecha de postulación"
                error={errors.appliedAt?.message}
              >
                <Input
                  id="app-appliedAt"
                  type="date"
                  max={today}
                  aria-invalid={errors.appliedAt ? true : undefined}
                  aria-describedby={errors.appliedAt ? 'app-appliedAt-error' : undefined}
                  {...register('appliedAt')}
                />
              </Field>
            )}
            <Field id="app-portal" label="Portal" error={errors.portal?.message}>
              <Input
                id="app-portal"
                placeholder="linkedin"
                aria-invalid={errors.portal ? true : undefined}
                aria-describedby={errors.portal ? 'app-portal-error' : undefined}
                {...register('portal')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="app-profile" label="Perfil">
              <select id="app-profile" className={SELECT_CLASS} {...profileField}>
                <option value="">Sin perfil</option>
                {(profiles.data ?? []).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.slug}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="app-link" label="Enlace">
              <select
                id="app-link"
                className={SELECT_CLASS}
                disabled={profileId === ''}
                {...linkField}
              >
                <option value="">Sin enlace</option>
                {manualLinks.map((link) => (
                  <option key={link.id} value={link.id}>
                    {link.label}
                    {link.revoked ? ' (revocado)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field id="app-notes" label="Notas" error={errors.notes?.message}>
            <Textarea
              id="app-notes"
              rows={4}
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={`app-notes-hint${errors.notes ? ' app-notes-error' : ''}`}
              {...register('notes')}
            />
            <p id="app-notes-hint" className="text-xs text-text-dim">
              No guardes datos de contacto de personas.
            </p>
          </Field>

          {apiError && (
            <p role="alert" className="text-sm text-danger-ink">
              {apiError}
            </p>
          )}

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

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-brand-ink"> *</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
