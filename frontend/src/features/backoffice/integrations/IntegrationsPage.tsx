import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { isHttpError } from '@/shared/lib/api-client';
import type { IntegrationStatus } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import {
  EMPTY_CREDENTIAL_FORM,
  credentialFormSchema,
  type CredentialFormValues,
} from './credential-form';
import {
  credentialLabel,
  formatDateTime,
  OUTCOME_LABELS,
  PAUSE_REASONS,
  STALE_LABEL,
  statusLabel,
} from './integration-text';
import {
  useDeleteCredential,
  useIntegrations,
  useSaveCredential,
  useSetIntegrationEnabled,
  useSyncIntegration,
} from './use-integrations-api';

export const SCHEDULER_OFF_MESSAGE =
  'El scheduler está apagado en este servidor: lo que encoles queda en espera.';
export const QUEUED_MESSAGE = 'Encolado: corre en el próximo minuto.';
export const ALREADY_QUEUED_MESSAGE = 'Ya había una sincronización en cola.';

/**
 * Integraciones con terceros (change `add-integrations-foundation`, D19). Sin ítem en la barra:
 * se llega desde Cuenta y desde el aviso del Dashboard (D25). **Sincronizar ahora** solo encola;
 * la credencial se escribe y nunca se vuelve a mostrar.
 */
export function IntegrationsPage() {
  const integrations = useIntegrations({ poll: true });

  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Sincronización con servicios externos: estado, cola, pausa y credenciales. Nada de esto aparece en el sitio público."
        actions={
          <Link to="/admin/cuenta" className="text-sm font-medium text-brand-ink hover:underline">
            Volver a Cuenta
          </Link>
        }
      />

      {integrations.isPending && <LoadingRows rows={2} />}
      {integrations.isError && (
        <ErrorPanel
          message={integrations.error.message}
          onRetry={() => void integrations.refetch()}
        />
      )}

      {integrations.data && (
        <div className="flex flex-col gap-6">
          {!integrations.data.schedulerEnabled && (
            <p role="status" className="surface px-4 py-3 text-sm">
              {SCHEDULER_OFF_MESSAGE}
            </p>
          )}

          {integrations.data.providers.length === 0 ? (
            <EmptyState
              title="No hay integraciones habilitadas."
              description="Se activan con la variable INTEGRATIONS_ENABLED del servidor."
            />
          ) : (
            integrations.data.providers.map((provider) => (
              <IntegrationCard key={provider.provider} status={provider} />
            ))
          )}
        </div>
      )}
    </>
  );
}

interface Feedback {
  kind: 'ok' | 'error';
  text: string;
}

function IntegrationCard({ status }: { status: IntegrationStatus }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const sync = useSyncIntegration();
  const setEnabled = useSetIntegrationEnabled();
  const headingId = `integration-${status.provider}`;
  const state = statusLabel(status);

  const onSync = () => {
    setFeedback(null);
    sync.mutate(status.provider, {
      onSuccess: (result) =>
        setFeedback({
          kind: 'ok',
          text: result.alreadyQueued ? ALREADY_QUEUED_MESSAGE : QUEUED_MESSAGE,
        }),
      onError: (error) =>
        setFeedback({
          kind: 'error',
          text: isHttpError(error, 422)
            ? 'La integración está pausada: reanudala para sincronizar.'
            : 'No se pudo encolar la sincronización. Intentá de nuevo.',
        }),
    });
  };

  const onToggle = () => {
    setFeedback(null);
    setEnabled.mutate(
      { provider: status.provider, enabled: !status.enabled },
      {
        onSuccess: (result) =>
          setFeedback({ kind: 'ok', text: result.enabled ? 'Reanudada.' : 'Pausada.' }),
        onError: () =>
          setFeedback({ kind: 'error', text: 'No se pudo cambiar el estado. Intentá de nuevo.' }),
      },
    );
  };

  return (
    <section aria-labelledby={headingId} className="surface p-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={headingId} className="text-lg font-semibold">
            {status.provider}
          </h2>
          <Badge variant="outline" className={state.tone}>
            {state.text}
          </Badge>
          {status.stale && (
            <Badge variant="outline" className="text-danger-ink">
              {STALE_LABEL}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSync} disabled={sync.isPending || !status.enabled}>
            <RefreshCw aria-hidden />
            Sincronizar ahora
          </Button>
          <Button variant="outline" onClick={onToggle} disabled={setEnabled.isPending}>
            {status.enabled ? <Pause aria-hidden /> : <Play aria-hidden />}
            {status.enabled ? 'Pausar' : 'Reanudar'}
          </Button>
        </div>
      </div>

      <p role="status" className="mb-3 min-h-5 text-sm">
        {feedback && (
          <span className={feedback.kind === 'error' ? 'text-danger-ink' : 'text-success-ink'}>
            {feedback.text}
          </span>
        )}
      </p>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Detail label="Última corrida">
          {status.lastRun ? (
            <>
              {status.lastRun.outcome ? OUTCOME_LABELS[status.lastRun.outcome] : 'En curso'}
              {' · '}
              {formatDateTime(status.lastRun.startedAt)}
            </>
          ) : (
            'Todavía no corrió'
          )}
        </Detail>
        <Detail label="Última exitosa">
          {status.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : 'Nunca'}
        </Detail>
        <Detail label="Cola">
          {status.jobs.pending} pendientes · {status.jobs.running} en curso · {status.jobs.failed}{' '}
          con error · {status.jobs.dead} fallidos
        </Detail>
        <Detail label="Credencial">{credentialLabel(status.credential)}</Detail>
        {status.pausedUntil && status.pauseReason && (
          <Detail label="Motivo de la pausa">
            {PAUSE_REASONS[status.pauseReason] ?? status.pauseReason}
          </Detail>
        )}
        {status.lastDeadError && (
          <Detail label="Último error fallido">
            <span className="break-words">{status.lastDeadError}</span>
          </Detail>
        )}
        {status.lastRun?.errorMessage && (
          <Detail label="Error de la última corrida">
            <span className="break-words">{status.lastRun.errorMessage}</span>
          </Detail>
        )}
      </dl>

      {status.credential.source !== 'env' && (
        <CredentialForm provider={status.provider} stored={status.credential.source === 'db'} />
      )}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** El campo nunca se rellena con el valor guardado: solo se escribe. */
function CredentialForm({ provider, stored }: { provider: string; stored: boolean }) {
  const save = useSaveCredential();
  const remove = useDeleteCredential();
  const [message, setMessage] = useState<Feedback | null>(null);
  const [confirming, setConfirming] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: EMPTY_CREDENTIAL_FORM,
    mode: 'onSubmit',
  });
  const inputId = `credential-${provider}`;

  const onSubmit = (values: CredentialFormValues) => {
    setMessage(null);
    save.mutate(
      { provider, secret: values.secret },
      {
        onSuccess: () => {
          reset(EMPTY_CREDENTIAL_FORM);
          setMessage({ kind: 'ok', text: 'Credencial guardada.' });
        },
        onError: (error) =>
          setMessage({
            kind: 'error',
            text: isHttpError(error, 422)
              ? 'La credencial de este proveedor viene de una variable de entorno.'
              : 'No se pudo guardar la credencial. Intentá de nuevo.',
          }),
      },
    );
  };

  const onDelete = () => {
    setMessage(null);
    remove.mutate(provider, {
      onSuccess: () => setMessage({ kind: 'ok', text: 'Credencial borrada.' }),
      onError: () =>
        setMessage({ kind: 'error', text: 'No se pudo borrar la credencial. Intentá de nuevo.' }),
    });
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="mt-5 flex flex-col gap-2 border-t border-border pt-4"
    >
      <Label htmlFor={inputId}>Credencial</Label>
      <p id={`${inputId}-help`} className="text-xs text-text-muted">
        Se guarda cifrada y no se vuelve a mostrar. Escribir una nueva reemplaza la anterior.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-64 flex-1">
          <Input
            id={inputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.secret ? true : undefined}
            aria-describedby={
              errors.secret ? `${inputId}-error ${inputId}-help` : `${inputId}-help`
            }
            {...register('secret')}
          />
          {errors.secret && (
            <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-danger-ink">
              {errors.secret.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={save.isPending}>
          <KeyRound aria-hidden />
          Guardar
        </Button>
        {stored && (
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            trigger={
              <Button type="button" variant="outline" disabled={remove.isPending}>
                <Trash2 aria-hidden />
                Borrar
              </Button>
            }
            title="Borrar la credencial"
            description="La sincronización de este proveedor va a fallar hasta que cargues otra credencial."
            confirmLabel="Borrar"
            onConfirm={onDelete}
          />
        )}
      </div>
      <p role="status" className="min-h-5 text-sm">
        {message && (
          <span className={message.kind === 'error' ? 'text-danger-ink' : 'text-success-ink'}>
            {message.text}
          </span>
        )}
      </p>
    </form>
  );
}
