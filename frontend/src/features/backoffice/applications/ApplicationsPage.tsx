import { useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { SESSION_QUERY_KEY } from '@/app/query-client';
import { formatCount } from '@/shared/i18n/plural';
import { isHttpError } from '@/shared/lib/api-client';
import type { Application, CreateApplicationBody } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { notifyError, notifySuccess } from '../shared/use-admin-api';
import { APPLICATION_MESSAGES } from './application-form';
import {
  FILTER_OPTIONS,
  filterStatuses,
  formatDay,
  formatInstant,
  parseFilter,
  STATUS_LABELS,
  STATUS_TONE,
  type StatusFilter,
} from './application-status';
import { ApplicationDialog } from './ApplicationDialog';
import { downloadApplicationsCsv } from './download-csv';
import { useApplications, useDeleteApplication, useSaveApplication } from './use-applications-api';

interface Editing {
  /** Sin valor, el diálogo crea una postulación. */
  application?: Application;
}

const EXPORT_ERROR = 'No se pudo exportar. Intentá de nuevo.';

/** CRM personal de postulaciones (change `add-application-tracking`). Solo panel: nada se publica. */
export function ApplicationsPage() {
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get('estado'));
  const statuses = filterStatuses(filter);
  const applications = useApplications(statuses);
  const save = useSaveApplication();
  const remove = useDeleteApplication();
  const client = useQueryClient();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const changeFilter = (next: StatusFilter) => setParams({ estado: next }, { replace: true });

  const openDialog = (next: Editing) => {
    setApiError(null);
    setEditing(next);
  };

  const handleSubmit = (body: CreateApplicationBody) => {
    setApiError(null);
    const id = editing?.application?.id;
    save.mutate(id === undefined ? { body } : { id, body }, {
      onSuccess: () => {
        notifySuccess(id === undefined ? 'Postulación creada' : 'Postulación actualizada');
        setEditing(null);
      },
      onError: (error) => {
        // 422 y 409 son respuestas de negocio: se explican en el diálogo, que sigue abierto.
        if (isHttpError(error, 422)) setApiError(APPLICATION_MESSAGES.transition);
        else if (isHttpError(error, 409)) setApiError(APPLICATION_MESSAGES.shareLinkTaken);
        else notifyError(error);
      },
    });
  };

  const handleDelete = (application: Application) => {
    remove.mutate(application.id, {
      onSuccess: () => notifySuccess('Postulación borrada'),
      onError: (error) => notifyError(error, 'No se pudo borrar'),
    });
  };

  const handleExport = () => {
    setExporting(true);
    downloadApplicationsCsv(statuses)
      .catch((error: unknown) => {
        // Sesión vencida: como en el resto del panel, se invalida y `RequireSession` manda al login.
        if (isHttpError(error, 401)) void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        else toast.error(EXPORT_ERROR);
      })
      .finally(() => setExporting(false));
  };

  return (
    <>
      <PageHeader
        title="Postulaciones"
        description="Tu seguimiento de procesos: a quién te postulaste, en qué estado está y si abrieron el enlace que mandaste. Solo lo ves vos."
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download aria-hidden />
              Exportar CSV
            </Button>
            <Button onClick={() => openDialog({})}>
              <Plus aria-hidden />
              Nueva postulación
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="application-filter">Estado</Label>
        <select
          id="application-filter"
          value={filter}
          onChange={(event) => changeFilter(event.target.value as StatusFilter)}
          className="h-9 rounded-theme-sm border border-border bg-bg px-3 text-sm"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {applications.isPending && <LoadingRows />}
      {applications.isError && (
        <ErrorPanel
          message={applications.error.message}
          onRetry={() => void applications.refetch()}
        />
      )}

      {applications.data?.length === 0 &&
        (filter === 'todas' ? (
          <EmptyState
            title="Todavía no registraste postulaciones"
            description="Creá la primera con «Nueva postulación»."
          />
        ) : (
          <EmptyState
            title="No hay postulaciones con este estado"
            description="Cambiá el filtro de estado o creá una nueva."
          />
        ))}

      {applications.data && applications.data.length > 0 && (
        <div className="surface p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa y puesto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Enlace</TableHead>
                <TableHead>Postulada</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.data.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="max-w-64">
                    <p className="truncate font-semibold">
                      {application.jobUrl ? (
                        <a
                          href={application.jobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-brand-ink hover:underline"
                        >
                          {application.company}
                        </a>
                      ) : (
                        application.company
                      )}
                    </p>
                    <p className="truncate text-xs text-text-muted">{application.role}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[application.status]}>
                      {STATUS_LABELS[application.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{application.portal ?? '—'}</TableCell>
                  <TableCell>{application.profileSlug ?? '—'}</TableCell>
                  <TableCell>
                    <OpenedCell application={application} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {application.appliedAt ? formatDay(application.appliedAt) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Editar ${application.company}`}
                        onClick={() => openDialog({ application })}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Borrar ${application.company}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        }
                        title="Borrar postulación"
                        description={`Se borrará la postulación a "${application.role}" en ${application.company}. Esta acción no se puede deshacer.`}
                        onConfirm={() => handleDelete(application)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <ApplicationDialog
          key={editing.application?.id ?? 'new'}
          application={editing.application}
          saving={save.isPending}
          apiError={apiError}
          onSubmit={handleSubmit}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </>
  );
}

/** «Abierto el 12/11/2026» o «Sin abrir»; la cantidad de aperturas va en el `title` (D8). */
function OpenedCell({ application }: { application: Application }) {
  const link = application.shareLink;
  if (!link) return <span className="text-text-dim">—</span>;
  const opened = link.firstOpenedAt !== null;
  const opens = formatCount(link.opens, { one: 'apertura', other: 'aperturas' });
  return (
    <div title={opens} className="max-w-48">
      <p className="truncate text-xs text-text-muted">
        {link.label}
        {link.revoked && ' (revocado)'}
      </p>
      <p className={opened ? 'text-sm font-medium text-success-ink' : 'text-sm text-text-muted'}>
        {opened ? `Abierto el ${formatInstant(link.firstOpenedAt ?? '')}` : 'Sin abrir'}
      </p>
    </div>
  );
}
