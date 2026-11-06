import { useId, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { HiddenBadge } from '../shared/HiddenBadge';
import type { OverrideMode } from './selection-overrides';

export interface OverrideRowProps {
  /** Nombre del ítem en los `aria-label`: «Incluir <nombre>» y «Excluir <nombre>». */
  name: string;
  /** Texto principal de la fila (empresa, skill o proyecto). */
  label: string;
  /** Complemento atenuado tras el texto principal («· rol»). */
  detail?: string;
  state: OverrideMode;
  /** El id figura en los dos arreglos: la exclusión gana y la fila lo aclara. */
  conflict?: boolean;
  /** El ítem tiene `visible: false`: el núcleo nunca lo incluye (D6). */
  hidden?: boolean;
  /** Género gramatical de «Oculta/Excluida» (experiencia y skill) frente a «Oculto/Excluido». */
  feminine?: boolean;
  onChange: (mode: OverrideMode) => void;
}

/**
 * Fila Incluir/Excluir compartida por experiencias, skills y proyectos (D4). Incluir y Excluir se
 * apagan entre sí (D5); un ítem oculto no se puede incluir salvo para quitar una inclusión
 * existente (D6).
 */
export function OverrideRow({
  name,
  label,
  detail,
  state,
  conflict = false,
  hidden = false,
  feminine = false,
  onChange,
}: OverrideRowProps) {
  const reasonId = useId();
  const included = state === 'include';
  const excluded = state === 'exclude';
  const includeBlocked = hidden && !included;
  const reason = feminine
    ? 'Oculta: no entra aunque la incluyas'
    : 'Oculto: no entra aunque lo incluyas';

  return (
    <li className="flex items-center gap-2 rounded-theme-sm border border-border px-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span className="min-w-0 truncate">
            {label}
            {detail && <span className="text-text-dim"> · {detail}</span>}
          </span>
          {hidden && <HiddenBadge feminine={feminine} />}
        </span>
        {conflict && (
          <span className="text-xs text-text-dim">
            {feminine ? 'Excluida' : 'Excluido'}: la exclusión gana sobre la inclusión
          </span>
        )}
      </span>
      {includeBlocked && (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      )}
      <Button
        type="button"
        size="xs"
        variant={included ? 'default' : 'outline'}
        aria-pressed={included}
        aria-label={`Incluir ${name}`}
        aria-describedby={includeBlocked ? reasonId : undefined}
        title={includeBlocked ? reason : undefined}
        disabled={includeBlocked}
        onClick={() => onChange(included ? 'none' : 'include')}
      >
        Incluir
      </Button>
      <Button
        type="button"
        size="xs"
        variant={excluded ? 'destructive' : 'outline'}
        aria-pressed={excluded}
        aria-label={`Excluir ${name}`}
        onClick={() => onChange(excluded ? 'none' : 'exclude')}
      >
        Excluir
      </Button>
    </li>
  );
}

/**
 * Región con altura máxima y desplazamiento propio. Es enfocable y tiene nombre: sin eso axe
 * marca `scrollable-region-focusable` (como en la región de `DashboardPage` que corrigió
 * `fix-admin-contrast`).
 */
export function OverrideScrollArea({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="max-h-72 overflow-y-auto pr-1">
      {children}
    </div>
  );
}

/** Lista de filas de un mismo bloque. */
export function OverrideList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1">{children}</ul>;
}
