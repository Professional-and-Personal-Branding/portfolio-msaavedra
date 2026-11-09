import { CircleAlert, Info, RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import type { CvEntityType, CvIssue, CvSeverity } from '../shared/admin-types';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { useCvConsistency } from '../shared/use-admin-api';
import { issueHref } from './issue-links';
import { experienceText, summaryText } from './revision-text';

/** Bloques de severidad, en el orden en que se muestran: texto + ícono, no solo color. */
const SEVERITIES: ReadonlyArray<{
  severity: CvSeverity;
  title: string;
  icon: LucideIcon;
  tone: string;
}> = [
  { severity: 'error', title: 'Errores', icon: CircleAlert, tone: 'text-danger-ink' },
  { severity: 'warning', title: 'Avisos', icon: TriangleAlert, tone: '' },
  { severity: 'info', title: 'Sugerencias', icon: Info, tone: 'text-text-muted' },
];

/** Tipos de entidad en el orden del backend (D8) y su título en la pantalla. */
const ENTITY_GROUPS: ReadonlyArray<{ type: CvEntityType; title: string }> = [
  { type: 'profile', title: 'Perfil' },
  { type: 'language', title: 'Idiomas' },
  { type: 'experience', title: 'Experiencias' },
  { type: 'skillCategory', title: 'Categorías de skills' },
  { type: 'skill', title: 'Skills' },
  { type: 'education', title: 'Formación' },
  { type: 'certification', title: 'Certificaciones' },
  { type: 'project', title: 'Proyectos' },
  { type: 'socialLink', title: 'Enlaces sociales' },
  { type: 'curatedProfile', title: 'Perfiles curados' },
];

/**
 * Revisión de consistencia del CV (D12 de `add-cv-consistency-rules`): lo que contradice al propio
 * CV, con el ítem exacto y un enlace para corregirlo. Es solo lectura: nada se corrige solo.
 */
export function RevisionPage() {
  const consistency = useCvConsistency();
  const report = consistency.data;

  return (
    <>
      <PageHeader
        title="Revisión"
        description="Lo que contradice al propio CV: fechas, traducciones, enlaces y perfiles curados. Nada se corrige solo."
        actions={
          <Button
            variant="outline"
            onClick={() => void consistency.refetch()}
            disabled={consistency.isFetching}
          >
            <RefreshCw aria-hidden />
            Volver a revisar
          </Button>
        }
      />

      {consistency.isPending && <LoadingRows />}
      {consistency.isError && (
        <ErrorPanel
          message={consistency.error.message}
          onRetry={() => void consistency.refetch()}
        />
      )}

      {report && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-semibold" data-testid="revision-summary">
              {summaryText(report.summary)}
            </p>
            {report.experience && (
              <p className="text-sm text-text-muted">
                {experienceText(report.experience.declaredYears, report.experience.derivedMonths)}
              </p>
            )}
          </div>

          {report.issues.length === 0 && (
            <EmptyState title="No hay hallazgos: el CV es consistente." />
          )}

          {SEVERITIES.map(({ severity, title, icon: Icon, tone }) => {
            const issues = report.issues.filter((issue) => issue.severity === severity);
            if (issues.length === 0) return null;
            return (
              <section key={severity} aria-labelledby={`revision-${severity}`} className="surface">
                <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden />
                  <h2 id={`revision-${severity}`} className="font-semibold">
                    {title}
                  </h2>
                  <span className="text-xs text-text-dim">{issues.length}</span>
                </header>
                <div className="flex flex-col gap-4 px-4 py-3">
                  {ENTITY_GROUPS.map(({ type, title: groupTitle }) => {
                    const group = issues.filter((issue) => issue.entityType === type);
                    if (group.length === 0) return null;
                    return <EntityGroup key={type} title={groupTitle} issues={group} />;
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function EntityGroup({ title, issues }: { title: string; issues: CvIssue[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li
            key={`${issue.code}|${issue.entityId}|${issue.field ?? ''}|${JSON.stringify(issue.params)}`}
            className="flex flex-wrap items-start gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{issue.entityLabel}</p>
              <p className="text-sm text-text-muted">{issue.message}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link
                to={issueHref(issue.entityType, issue.entityId)}
                aria-label={`Abrir ${issue.entityLabel}`}
              >
                Abrir
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
