import { useState, type FormEvent, type ReactNode } from 'react';
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
import type { CreateCertificationBody, CreateEducationBody } from '../shared/admin-types';
import { LocalizedField } from '../shared/fields/LocalizedField';
import { UnsavedChangesPrompt } from '../shared/UnsavedChangesPrompt';
import { useDialogDiscardGuard, type DialogDiscardGuard } from '../shared/use-dialog-discard-guard';
import {
  certificationSchema,
  educationSchema,
  EMPTY_CERTIFICATION,
  EMPTY_EDUCATION,
  fieldErrors,
  toCertificationBody,
  toEducationBody,
  type CertificationFormValues,
  type EducationFormValues,
} from './formacion-form';

interface DialogFormProps<V, B> {
  open: boolean;
  title: string;
  initialValues?: V;
  saving: boolean;
  onSubmit: (body: B) => void;
  onOpenChange: (open: boolean) => void;
}

const DESCRIPTION =
  'Los campos con * son obligatorios. La traducción al inglés es opcional: si falta, la vista pública en inglés muestra el texto en español.';

/** Formulario de una formación académica (spec `admin-content-management`). */
export function EducationForm({
  open,
  title,
  initialValues,
  saving,
  onSubmit,
  onOpenChange,
}: DialogFormProps<EducationFormValues, CreateEducationBody>) {
  const [values, setValues] = useState<EducationFormValues>(initialValues ?? EMPTY_EDUCATION);
  const [initial] = useState<EducationFormValues>(initialValues ?? EMPTY_EDUCATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const guard = useDialogDiscardGuard({
    dirty: JSON.stringify(toEducationBody(values)) !== JSON.stringify(toEducationBody(initial)),
    onClose: () => onOpenChange(false),
  });

  const set = <K extends keyof EducationFormValues>(key: K, value: EducationFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = fieldErrors(educationSchema, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toEducationBody(values));
  };

  return (
    <FormDialog open={open} title={title} guard={guard}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <LocalizedField
          label="Título"
          required
          value={values.degree}
          error={errors.degree}
          onChange={(value) => set('degree', { es: value.es, en: value.en ?? '' })}
        />
        <TextField
          id="education-institution"
          label="Institución"
          required
          value={values.institution}
          error={errors.institution}
          onChange={(value) => set('institution', value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            id="education-start"
            label="Inicio"
            required
            placeholder="2024-02"
            hint="AAAA-MM o AAAA"
            value={values.startDate}
            error={errors.startDate}
            onChange={(value) => set('startDate', value)}
          />
          <TextField
            id="education-end"
            label="Fin"
            placeholder="2026-12"
            disabled={values.inProgress}
            value={values.endDate}
            error={errors.endDate}
            onChange={(value) => set('endDate', value)}
          />
          <OrderField
            id="education-order"
            value={values.order}
            error={errors.order}
            onChange={(value) => set('order', value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <SwitchField
            id="education-in-progress"
            label="En curso"
            checked={values.inProgress}
            onChange={(checked) =>
              setValues((current) => ({
                ...current,
                inProgress: checked,
                endDate: checked ? '' : current.endDate,
              }))
            }
          />
          <SwitchField
            id="education-visible"
            label="Visible en el sitio"
            checked={values.visible}
            onChange={(checked) => set('visible', checked)}
          />
        </div>
        <FormFooter saving={saving} onCancel={guard.requestClose} />
      </form>
    </FormDialog>
  );
}

/** Formulario de una certificación (spec `admin-content-management`). */
export function CertificationForm({
  open,
  title,
  initialValues,
  saving,
  onSubmit,
  onOpenChange,
}: DialogFormProps<CertificationFormValues, CreateCertificationBody>) {
  const [values, setValues] = useState<CertificationFormValues>(
    initialValues ?? EMPTY_CERTIFICATION,
  );
  const [initial] = useState<CertificationFormValues>(initialValues ?? EMPTY_CERTIFICATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const guard = useDialogDiscardGuard({
    dirty:
      JSON.stringify(toCertificationBody(values)) !== JSON.stringify(toCertificationBody(initial)),
    onClose: () => onOpenChange(false),
  });

  const set = <K extends keyof CertificationFormValues>(
    key: K,
    value: CertificationFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = fieldErrors(certificationSchema, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toCertificationBody(values));
  };

  return (
    <FormDialog open={open} title={title} guard={guard}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <LocalizedField
          label="Nombre"
          required
          value={values.name}
          error={errors.name}
          onChange={(value) => set('name', { es: value.es, en: value.en ?? '' })}
        />
        <TextField
          id="certification-issuer"
          label="Emisor"
          required
          value={values.issuer}
          error={errors.issuer}
          onChange={(value) => set('issuer', value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="certification-year"
            label="Año"
            placeholder="2021"
            hint="AAAA; dejalo vacío si no lo sabés"
            value={values.year}
            error={errors.year}
            onChange={(value) => set('year', value)}
          />
          <OrderField
            id="certification-order"
            value={values.order}
            error={errors.order}
            onChange={(value) => set('order', value)}
          />
        </div>
        <TextField
          id="certification-verification-url"
          label="Enlace de verificación"
          type="url"
          inputMode="url"
          placeholder="https://www.credly.com/badges/…"
          hint="La página pública de la credencial en el emisor, por ejemplo Credly o Accredible"
          value={values.verificationUrl}
          error={errors.verificationUrl}
          onChange={(value) => set('verificationUrl', value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="certification-credential-id"
            label="ID de credencial"
            value={values.credentialId}
            error={errors.credentialId}
            onChange={(value) => set('credentialId', value)}
          />
          <TextField
            id="certification-expires"
            label="Vence"
            placeholder="AAAA-MM"
            hint="AAAA-MM o AAAA; dejalo vacío si no vence"
            value={values.expiresAt}
            error={errors.expiresAt}
            onChange={(value) => set('expiresAt', value)}
          />
        </div>
        <SwitchField
          id="certification-visible"
          label="Visible en el sitio"
          checked={values.visible}
          onChange={(checked) => set('visible', checked)}
        />
        <FormFooter saving={saving} onCancel={guard.requestClose} />
      </form>
    </FormDialog>
  );
}

// ── Piezas compartidas ──────────────────────────────────────────────────────
function FormDialog({
  open,
  title,
  guard,
  children,
}: {
  open: boolean;
  title: string;
  guard: DialogDiscardGuard;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && guard.requestClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        {children}
        <UnsavedChangesPrompt {...guard.promptProps} />
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  hint,
  error,
  type,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  type?: 'text' | 'url';
  inputMode?: 'url';
}) {
  // El mensaje o la ayuda se asocian al campo para que el lector de pantalla los anuncie.
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-brand-ink"> *</span>}
      </Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-text-dim">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function OrderField({
  id,
  value,
  error,
  onChange,
}: {
  id: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Orden</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <FieldError message={error} />
    </div>
  );
}

function SwitchField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

function FormFooter({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar'}
      </Button>
    </DialogFooter>
  );
}
