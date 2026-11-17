import { Zap } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { isHttpError } from '@/shared/lib/api-client';
import type { AiRun } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { ErrorPanel, LoadingRows } from '../shared/states';
import {
  AI_CONFIRM_FAKE,
  AI_CONFIRM_REAL,
  AI_DISABLED_TEXT,
  AI_DISABLED_TEXT_END,
  costLabel,
  dayLabel,
  durationLabel,
  RUN_STATUS_LABELS,
  spentLine,
  STATE_TONE,
  stateText,
  tokensLabel,
  usd2,
} from './ai-text';
import { formatDateTime } from './integration-text';
import { useAiSmoke, useAiUsage } from './use-ai-usage-api';

export const SMOKE_OK_MESSAGE = 'Conexión verificada.';

interface Feedback {
  kind: 'ok' | 'error';
  text: string;
}

/**
 * Bloque «Inteligencia artificial» de `/admin/integraciones` (change `add-ai-foundation`, D18):
 * solo lectura, sin ítem en la barra. Estado por texto, gasto del mes contra el tope, bloqueo del
 * proveedor, corridas recientes y **Probar conexión**, que confirma antes si la llamada es real.
 */
export function AiUsageBlock() {
  const usage = useAiUsage();
  const smoke = useAiSmoke();
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const onConfirm = () => {
    setFeedback(null);
    smoke.mutate(undefined, {
      onSuccess: (run) =>
        setFeedback(
          run.status === 'SUCCEEDED'
            ? { kind: 'ok', text: SMOKE_OK_MESSAGE }
            : {
                kind: 'error',
                text: `La prueba no salió bien: ${run.failureMessage ?? RUN_STATUS_LABELS[run.status]}`,
              },
        ),
      onError: (error) =>
        setFeedback({
          kind: 'error',
          text: isHttpError(error, 429)
            ? 'Esperá un minuto: la prueba de conexión admite 5 por minuto.'
            : isHttpError(error, 503)
              ? 'Hay demasiadas consultas de IA en curso: esperá unos segundos.'
              : error.message,
        }),
    });
  };

  return (
    <section aria-labelledby="ai-usage-heading" className="surface p-card">
      <h2 id="ai-usage-heading" className="mb-4 text-lg font-semibold">
        Inteligencia artificial
      </h2>

      {usage.isPending && <LoadingRows rows={2} />}
      {usage.isError && (
        <ErrorPanel message={usage.error.message} onRetry={() => void usage.refetch()} />
      )}

      {usage.data && (
        <div className="flex flex-col gap-4">
          {usage.data.state === 'DISABLED' ? (
            <p role="status" className="text-sm">
              {AI_DISABLED_TEXT} <code>AI_ENABLED</code> {AI_DISABLED_TEXT_END}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className={STATE_TONE[usage.data.state]}>
                    {stateText(usage.data)}
                  </Badge>
                  <span>{spentLine(usage.data)}</span>
                </p>
                <ConfirmDialog
                  open={confirming}
                  onOpenChange={setConfirming}
                  trigger={
                    <Button
                      variant="outline"
                      disabled={smoke.isPending || usage.data.state === 'EXHAUSTED'}
                    >
                      <Zap aria-hidden />
                      Probar conexión
                    </Button>
                  }
                  title="Probar la conexión"
                  description={usage.data.provider === 'fake' ? AI_CONFIRM_FAKE : AI_CONFIRM_REAL}
                  confirmLabel="Probar"
                  onConfirm={onConfirm}
                />
              </div>

              <p role="status" className="min-h-5 text-sm">
                {feedback && (
                  <span
                    className={feedback.kind === 'error' ? 'text-danger-ink' : 'text-success-ink'}
                  >
                    {feedback.text}
                  </span>
                )}
              </p>

              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {usage.data.reservedUsd > 0 && (
                  <div>
                    <dt className="text-text-muted">Reservado en curso</dt>
                    <dd className="font-medium">{usd2(usage.data.reservedUsd)} USD</dd>
                  </div>
                )}
                <div>
                  <dt className="text-text-muted">Precios verificados</dt>
                  <dd className="font-medium">el {dayLabel(usage.data.pricingVerifiedAt)}</dd>
                </div>
                {usage.data.providerBlockedUntil && (
                  <div>
                    <dt className="text-text-muted">Corte del proveedor</dt>
                    <dd className="font-medium">
                      hasta {formatDateTime(usage.data.providerBlockedUntil)}
                    </dd>
                  </div>
                )}
              </dl>

              <RecentRuns runs={usage.data.recentRuns} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function RecentRuns({ runs }: { runs: readonly AiRun[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-text-muted">Todavía no hay corridas de IA este mes.</p>;
  }
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Corridas recientes</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tarea</TableHead>
            <TableHead>Versión</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Tokens (entrada / salida)</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>De caché</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>{formatDateTime(run.createdAt)}</TableCell>
              <TableCell className="font-mono text-xs">{run.task}</TableCell>
              <TableCell>v{run.promptVersion}</TableCell>
              <TableCell className="font-mono text-xs">{run.model}</TableCell>
              <TableCell>{RUN_STATUS_LABELS[run.status]}</TableCell>
              <TableCell>{tokensLabel(run)}</TableCell>
              <TableCell>{costLabel(run.costMicroUsd)}</TableCell>
              <TableCell>{durationLabel(run.durationMs)}</TableCell>
              <TableCell>{run.fromCache ? 'Sí' : 'No'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
