import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Textarea } from '@/shared/components/ui/textarea';
import { formatCount } from '@/shared/i18n/plural';
import { isHttpError } from '@/shared/lib/api-client';
import type { JobPosting, JobPostingSuggestion } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { notifyError, notifySuccess } from '../shared/use-admin-api';
import {
  draftSchema,
  EMPTY_INTAKE,
  intakeSchema,
  JOB_POSTING_MESSAGES,
  toImportBody,
  validateChosenTags,
  type DraftFormValues,
  type IntakeFormValues,
} from './job-posting-form';
import {
  useCreateDraftFromJobPosting,
  useDeleteJobPosting,
  useImportJobPosting,
  useJobPosting,
  useJobPostings,
  useJobPostingSuggestion,
} from './use-job-postings-api';

const SOURCE_LABELS: Record<JobPosting['source'], string> = {
  GREENHOUSE: 'Greenhouse',
  LEVER: 'Lever',
  ASHBY: 'Ashby',
  JSON_LD: 'Página de empleo',
  PASTED: 'Texto pegado',
};

const WORKPLACE_LABELS = { REMOTE: 'Remoto', HYBRID: 'Híbrido', ONSITE: 'Presencial' } as const;

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' });
const formatDate = (iso: string): string => dateFormat.format(new Date(iso));

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-xs text-danger-ink">
      {message}
    </p>
  );
}

/**
 * Crear un perfil curado desde una vacante (change `add-job-posting-intake`, D18). El estado vive
 * en la URL (`?vacante={id}`) y en memoria: sin `localStorage` ni `sessionStorage`.
 */
export function JobPostingIntakePage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get('vacante');
  const [importError, setImportError] = useState<string | null>(null);
  const [mode, setMode] = useState<IntakeFormValues['mode']>('url');
  const [carry, setCarry] = useState<string>('');

  const open = (id: string | null) =>
    setParams(id === null ? {} : { vacante: id }, { replace: false });

  return (
    <>
      <PageHeader
        title="Crear desde una vacante"
        description="Pegá la URL o el texto de una vacante: te mostramos qué parte de lo que pide ya está en tus datos y armamos un borrador privado del perfil curado."
      />

      <div className="flex flex-col gap-8">
        <IntakeForm
          mode={mode}
          onModeChange={setMode}
          carriedReference={carry}
          error={importError}
          onError={setImportError}
          onSwitchToText={(url) => {
            setCarry(url);
            setMode('text');
            setImportError(null);
          }}
          onImported={(id) => {
            setImportError(null);
            open(id);
          }}
        />

        {openId && <PostingAnalysis key={openId} id={openId} onGone={() => open(null)} />}

        <ImportedPostingsTable openId={openId} onOpen={open} />
      </div>
    </>
  );
}

// ── Formulario de importación ───────────────────────────────────────────────

interface IntakeFormProps {
  mode: IntakeFormValues['mode'];
  onModeChange: (mode: IntakeFormValues['mode']) => void;
  /** URL que pasó de «URL» a «URL de referencia» al pulsar «Pegar el texto». */
  carriedReference: string;
  error: string | null;
  onError: (message: string | null) => void;
  onSwitchToText: (url: string) => void;
  onImported: (id: string) => void;
}

function IntakeForm({
  mode,
  onModeChange,
  carriedReference,
  error,
  onError,
  onSwitchToText,
  onImported,
}: IntakeFormProps) {
  const importPosting = useImportJobPosting();
  const modeName = useId();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    getValues,
    formState: { errors },
  } = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: { ...EMPTY_INTAKE, mode },
  });
  const url = useWatch({ control, name: 'url' });

  const changeMode = (next: IntakeFormValues['mode']) => {
    setValue('mode', next);
    onModeChange(next);
    onError(null);
    if (next === 'text' && carriedReference !== '' && getValues('referenceUrl') === '') {
      setValue('referenceUrl', carriedReference);
    }
  };

  const submit = handleSubmit((values) => {
    onError(null);
    importPosting.mutate(toImportBody(values), {
      onSuccess: ({ posting, created }) => {
        notifySuccess(created ? 'Vacante importada' : 'Vacante actualizada');
        onImported(posting.id);
      },
      onError: (failure) => {
        if (isHttpError(failure, 429)) onError(JOB_POSTING_MESSAGES.rateLimited);
        else if (isHttpError(failure, 422) || isHttpError(failure, 400)) onError(failure.message);
        else notifyError(failure, 'No se pudo importar la vacante');
      },
    });
  });

  const pasteText = () => {
    const current = url.trim();
    onSwitchToText(current);
    setValue('mode', 'text');
    if (current !== '') setValue('referenceUrl', current);
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="surface flex flex-col gap-4 p-5"
    >
      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <legend className="mb-1 text-sm font-medium">Origen</legend>
        {(['url', 'text'] as const).map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={modeName}
              value={value}
              checked={mode === value}
              onChange={() => changeMode(value)}
            />
            {value === 'url' ? 'URL' : 'Texto'}
          </label>
        ))}
      </fieldset>

      {mode === 'url' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intake-url">URL de la vacante</Label>
          <Input
            id="intake-url"
            inputMode="url"
            placeholder="https://jobs.lever.co/empresa/…"
            aria-invalid={errors.url ? true : undefined}
            aria-describedby={['intake-url-help', errors.url ? 'intake-url-error' : null]
              .filter(Boolean)
              .join(' ')}
            {...register('url')}
          />
          <p id="intake-url-help" className="text-xs text-text-muted">
            Greenhouse, Lever, Ashby o la página de empleo de la empresa. LinkedIn, Indeed y otros
            portales no se pueden leer: usá Texto.
          </p>
          <FieldError id="intake-url" message={errors.url?.message} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-text">Texto de la vacante</Label>
            <Textarea
              id="intake-text"
              rows={8}
              aria-invalid={errors.text ? true : undefined}
              aria-describedby={errors.text ? 'intake-text-error' : undefined}
              {...register('text')}
            />
            <FieldError id="intake-text" message={errors.text?.message} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="intake-title">Título</Label>
              <Input
                id="intake-title"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? 'intake-title-error' : undefined}
                {...register('title')}
              />
              <FieldError id="intake-title" message={errors.title?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="intake-company">Empresa</Label>
              <Input
                id="intake-company"
                aria-invalid={errors.company ? true : undefined}
                aria-describedby={errors.company ? 'intake-company-error' : undefined}
                {...register('company')}
              />
              <FieldError id="intake-company" message={errors.company?.message} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-reference">URL de referencia</Label>
            <Input
              id="intake-reference"
              inputMode="url"
              aria-invalid={errors.referenceUrl ? true : undefined}
              aria-describedby={[
                'intake-reference-help',
                errors.referenceUrl ? 'intake-reference-error' : null,
              ]
                .filter(Boolean)
                .join(' ')}
              {...register('referenceUrl')}
            />
            <p id="intake-reference-help" className="text-xs text-text-muted">
              Opcional. Se guarda como enlace a la vacante; nunca se abre desde el servidor.
            </p>
            <FieldError id="intake-reference" message={errors.referenceUrl?.message} />
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm text-danger-ink">
          <p>{error}</p>
          {mode === 'url' && error !== JOB_POSTING_MESSAGES.rateLimited && (
            <Button type="button" variant="outline" size="sm" onClick={pasteText}>
              Pegar el texto
            </Button>
          )}
        </div>
      )}

      <div>
        <Button
          type="submit"
          disabled={importPosting.isPending}
          aria-busy={importPosting.isPending}
        >
          {importPosting.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Analizar vacante
        </Button>
      </div>
    </form>
  );
}

// ── Análisis de una vacante ─────────────────────────────────────────────────

function PostingAnalysis({ id, onGone }: { id: string; onGone: () => void }) {
  const posting = useJobPosting(id);
  const suggestion = useJobPostingSuggestion(id);

  if (posting.isPending || suggestion.isPending) return <LoadingRows rows={3} />;
  if (isHttpError(posting.error, 404) || isHttpError(suggestion.error, 404)) {
    return (
      <div role="alert" className="surface flex flex-col items-start gap-3 p-5 text-sm">
        <p>Esa vacante ya no existe.</p>
        <Button variant="outline" size="sm" onClick={onGone}>
          Cerrar
        </Button>
      </div>
    );
  }
  if (posting.isError || suggestion.isError) {
    return (
      <ErrorPanel
        message={(posting.error ?? suggestion.error)?.message}
        onRetry={() => {
          void posting.refetch();
          void suggestion.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PostingSummary posting={posting.data} />
      <CoverageAndDraft key={posting.data.id} posting={posting.data} suggestion={suggestion.data} />
    </div>
  );
}

function PostingSummary({ posting }: { posting: JobPosting }) {
  const meta = [
    posting.company,
    posting.location,
    posting.workplaceType ? WORKPLACE_LABELS[posting.workplaceType] : null,
    SOURCE_LABELS[posting.source],
  ].filter((part): part is string => !!part);

  return (
    <section aria-labelledby="posting-title" className="surface flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="posting-title" className="text-lg font-semibold">
            {posting.title}
          </h2>
          <p className="text-sm text-text-muted">{meta.join(' · ')}</p>
        </div>
        {posting.applyUrl && (
          <a
            href={posting.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline"
          >
            Ver la vacante
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>

      {posting.description !== null && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Descripción de la vacante</summary>
          <p className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap text-text-muted">
            {posting.description}
          </p>
        </details>
      )}
      <p className="text-xs text-text-muted">
        {posting.textPurged
          ? `El texto se borró el ${formatDate(posting.textPurgeAt)}`
          : `El texto se borra el ${formatDate(posting.textPurgeAt)}`}
      </p>
    </section>
  );
}

function coverageHeadline(coverage: JobPostingSuggestion['coverage']): string {
  if (coverage.ratio === null) return 'No detectamos requisitos conocidos en esta vacante';
  return `Cubre ${coverage.coveredCount} de ${coverage.detectedCount} requisitos detectados (${Math.round(coverage.ratio * 100)} %)`;
}

function CoverageAndDraft({
  posting,
  suggestion,
}: {
  posting: JobPosting;
  suggestion: JobPostingSuggestion;
}) {
  const navigate = useNavigate();
  const createDraft = useCreateDraftFromJobPosting();
  const [chosen, setChosen] = useState<string[]>(suggestion.suggestedFilterTags);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const { coverage } = suggestion;

  const defaults = useMemo<DraftFormValues>(
    () => ({ title: suggestion.suggestedTitle, slug: '' }),
    [suggestion.suggestedTitle],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DraftFormValues>({ resolver: zodResolver(draftSchema), defaultValues: defaults });

  const toggle = (tag: string, checked: boolean) => {
    setTagsError(null);
    setChosen((current) =>
      checked ? [...current, tag] : current.filter((entry) => entry !== tag),
    );
  };

  const submit = handleSubmit((values) => {
    const missing = validateChosenTags(chosen);
    setTagsError(missing);
    if (missing) return;
    setApiError(null);
    createDraft.mutate(
      {
        jobPostingId: posting.id,
        filterTags: chosen,
        ...(values.title ? { title: values.title } : {}),
        ...(values.slug ? { slug: values.slug } : {}),
      },
      {
        onSuccess: (profile) => {
          notifySuccess('Borrador creado. Es privado hasta que lo publiques.');
          void navigate(`/admin/perfiles/${profile.id}`);
        },
        onError: (failure) => {
          if (isHttpError(failure, 400) || isHttpError(failure, 409) || isHttpError(failure, 404)) {
            setApiError(failure.message);
          } else notifyError(failure, 'No se pudo crear el borrador');
        },
      },
    );
  });

  return (
    <section aria-labelledby="coverage-title" className="surface flex flex-col gap-5 p-5">
      <h2 id="coverage-title" className="text-lg font-semibold">
        {coverageHeadline(coverage)}
      </h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Con respaldo en tus datos</h3>
          {coverage.covered.length === 0 ? (
            <p className="text-sm text-text-muted">
              Ningún requisito detectado figura en tus tags.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {coverage.covered.map((entry) => {
                const inputId = `cover-${entry.tag}`;
                return (
                  <li key={entry.tag} className="flex items-center gap-2 text-sm">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={chosen.includes(entry.tag)}
                      onChange={(event) => toggle(entry.tag, event.target.checked)}
                    />
                    <label htmlFor={inputId} className="font-medium">
                      {entry.tag}
                    </label>
                    <span className="text-xs text-text-muted">
                      en {formatCount(entry.evidence, { one: 'ítem', other: 'ítems' })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Sin respaldo</h3>
          {coverage.uncovered.length === 0 ? (
            <p className="text-sm text-text-muted">No hay requisitos sin respaldo.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {coverage.uncovered.map((term) => (
                <li
                  key={term}
                  className="rounded-theme-sm border border-border px-2 py-0.5 text-sm"
                >
                  {term}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        className="flex flex-col gap-4 border-t border-border pt-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-title">Título del perfil</Label>
            <Input
              id="draft-title"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'draft-title-error' : undefined}
              {...register('title')}
            />
            <FieldError id="draft-title" message={errors.title?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-slug">Slug (opcional)</Label>
            <Input
              id="draft-slug"
              aria-invalid={errors.slug ? true : undefined}
              aria-describedby={['draft-slug-help', errors.slug ? 'draft-slug-error' : null]
                .filter(Boolean)
                .join(' ')}
              {...register('slug')}
            />
            <p id="draft-slug-help" className="text-xs text-text-muted">
              Si lo dejás vacío, se arma con la empresa y el puesto.
            </p>
            <FieldError id="draft-slug" message={errors.slug?.message} />
          </div>
        </div>

        {tagsError && (
          <p role="alert" className="text-sm text-danger-ink">
            {tagsError}
          </p>
        )}
        {apiError && (
          <p role="alert" className="text-sm text-danger-ink">
            {apiError}
          </p>
        )}

        <div>
          <Button type="submit" disabled={createDraft.isPending} aria-busy={createDraft.isPending}>
            {createDraft.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Crear borrador
          </Button>
        </div>
      </form>
    </section>
  );
}

// ── Vacantes importadas ─────────────────────────────────────────────────────

function ImportedPostingsTable({
  openId,
  onOpen,
}: {
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const postings = useJobPostings();
  const remove = useDeleteJobPosting();

  return (
    <section aria-labelledby="imported-title" className="flex flex-col gap-3">
      <h2 id="imported-title" className="text-lg font-semibold">
        Vacantes importadas
      </h2>

      {postings.isPending && <LoadingRows rows={2} />}
      {postings.isError && (
        <ErrorPanel message={postings.error.message} onRetry={() => void postings.refetch()} />
      )}
      {postings.data?.length === 0 && (
        <EmptyState
          title="Todavía no importaste vacantes"
          description="Analizá la primera con el formulario de arriba."
        />
      )}
      {postings.data && postings.data.length > 0 && (
        <div className="surface p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Puesto y empresa</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Importada</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {postings.data.map((posting) => (
                <TableRow key={posting.id}>
                  <TableCell className="max-w-72">
                    <p className="truncate font-semibold">{posting.title}</p>
                    <p className="truncate text-xs text-text-muted">{posting.company ?? '—'}</p>
                  </TableCell>
                  <TableCell>{SOURCE_LABELS[posting.source]}</TableCell>
                  <TableCell>{formatDate(posting.importedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Abrir ${posting.title}`}
                        onClick={() => onOpen(posting.id)}
                      >
                        Abrir
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Borrar ${posting.title}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        }
                        title="¿Borrar la vacante?"
                        description="Se borra la vacante importada y su análisis. Los perfiles curados creados desde ella no cambian."
                        onConfirm={() =>
                          remove.mutate(posting.id, {
                            onSuccess: () => {
                              notifySuccess('Vacante borrada');
                              if (openId === posting.id) onOpen(null);
                            },
                            onError: (error) => notifyError(error, 'No se pudo borrar'),
                          })
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
