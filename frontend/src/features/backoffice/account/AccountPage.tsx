import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { HttpError } from '@/shared/lib/api-client';
import { useChangePassword, useSession } from '../auth/use-session';
import { PageHeader } from '../shared/PageHeader';
import { notifySuccess } from '../shared/use-admin-api';
import {
  EMPTY_PASSWORD_FORM,
  PASSWORD_CHANGED_MESSAGE,
  passwordErrorMessage,
  passwordFormSchema,
  type PasswordFormValues,
} from './password-form';

/**
 * Cuenta del administrador: cambio de contraseña (spec `admin-backoffice-shell`, change
 * `add-admin-password-change`). Ninguna contraseña ni token toca el almacenamiento del navegador,
 * y los campos quedan fuera del aviso de cambios sin guardar (no hay borrador que proteger).
 */
export function AccountPage() {
  const { data: admin } = useSession();
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: EMPTY_PASSWORD_FORM,
    mode: 'onTouched',
  });

  const onSubmit = (values: PasswordFormValues) => {
    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          reset(EMPTY_PASSWORD_FORM);
          notifySuccess(PASSWORD_CHANGED_MESSAGE);
        },
      },
    );
  };

  const apiMessage = changePassword.isError
    ? passwordErrorMessage(
        changePassword.error instanceof HttpError ? changePassword.error.status : undefined,
      )
    : null;

  return (
    <>
      <PageHeader title="Cuenta" description="Tus datos de acceso al panel." />

      <section aria-labelledby="account-data" className="surface mb-6 p-card">
        <h2 id="account-data" className="mb-3 text-lg font-semibold">
          Administrador
        </h2>
        {admin && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-muted">Nombre</dt>
              <dd className="font-medium" data-testid="account-name">
                {admin.name}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Email</dt>
              <dd className="font-medium" data-testid="account-email">
                {admin.email}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section aria-labelledby="account-password" className="surface max-w-xl p-card">
        <h2 id="account-password" className="mb-1 text-lg font-semibold">
          Cambiar contraseña
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          La nueva contraseña tiene entre 12 y 256 caracteres. Al cambiarla se cierran las sesiones
          abiertas en otros dispositivos; esta sigue activa.
        </p>

        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          noValidate
          className="flex flex-col gap-4"
        >
          <PasswordField
            id="current-password"
            label="Contraseña actual"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            registration={register('currentPassword')}
          />
          <PasswordField
            id="new-password"
            label="Nueva contraseña"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            registration={register('newPassword')}
          />
          <PasswordField
            id="confirm-password"
            label="Repetí la nueva contraseña"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            registration={register('confirmPassword')}
          />

          {apiMessage && (
            <p role="alert" className="text-sm text-destructive">
              {apiMessage}
            </p>
          )}

          <div>
            <Button type="submit" disabled={changePassword.isPending}>
              <KeyRound aria-hidden />
              {changePassword.isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  error,
  registration,
}: {
  id: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<PasswordFormValues>>['register']>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
