import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react';
import { Link } from 'react-router';
import type { AdminRepository } from '../shared/admin-types';
import { useIntegrations } from '../integrations/use-integrations-api';
import { evidenceBadge, githubSyncWarning, movedNotice } from './repository-evidence-text';

const TONE_CLASS = {
  ok: 'text-success-ink',
  problem: 'text-danger-ink',
  pending: 'text-text-muted',
} as const;

/**
 * Estado de la verificación contra GitHub de un repositorio (change `add-github-code-evidence`,
 * D12). Texto + ícono: no depende del color. Si GitHub lo movió, pide actualizar la URL.
 */
export function RepositoryEvidenceStatus({ evidence }: { evidence: AdminRepository['evidence'] }) {
  const badge = evidenceBadge(evidence);
  const moved = movedNotice(evidence);
  const Icon =
    badge.tone === 'ok' ? CheckCircle2 : badge.tone === 'problem' ? AlertTriangle : CircleHelp;
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-xs">
      <p className={`inline-flex items-center gap-1 font-medium ${TONE_CLASS[badge.tone]}`}>
        <Icon className="size-3 shrink-0" aria-hidden />
        {badge.text}
      </p>
      {badge.hint && <p className="text-text-muted">{badge.hint}</p>}
      {moved && (
        <p className="inline-flex items-center gap-1 font-medium text-danger-ink">
          <AlertTriangle className="size-3 shrink-0" aria-hidden />
          {moved}
        </p>
      )}
    </div>
  );
}

/**
 * Aviso del bloque Repositorios cuando la última sincronización con GitHub falló. Sale de
 * `GET /api/admin/integrations`; si la consulta falla o `github` no está habilitado, no muestra
 * nada y el resto del bloque sigue (el estado de cada repositorio no depende de esta consulta).
 */
export function GithubSyncNotice() {
  const integrations = useIntegrations();
  const warning = githubSyncWarning(integrations.data);
  if (!warning) return null;
  return (
    <section
      aria-label="Aviso de la sincronización con GitHub"
      className="surface flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
    >
      <p className="font-medium">{warning}</p>
      <Link to="/admin/integraciones" className="font-medium text-brand-ink hover:underline">
        Ver integraciones
      </Link>
    </section>
  );
}
