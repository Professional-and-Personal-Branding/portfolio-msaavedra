import { Pencil, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Hero } from '@/shared/components/portfolio/Hero';
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
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import type { Locale } from '@/shared/i18n/locale';
import { useLocale } from '@/shared/i18n/use-locale';
import type { CuratedProfile } from '@/shared/types/portfolio';
import type { AdminLanguage, LocalizedText, ProfilePreview } from '../shared/admin-types';
import { es } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { LocalizedField } from '../shared/fields/LocalizedField';
import { toLocalizedPayload } from '../shared/fields/localized';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { notifyError, notifySuccess } from '../shared/use-admin-api';
import {
  toPortadaDraft,
  validatePortada,
  type PortadaDraft,
  type PortadaErrors,
} from './portada-draft';
import {
  useAdminProfile,
  useDeleteLanguage,
  useLanguages,
  useProfilePreview,
  useReplaceProfile,
  useSaveLanguage,
} from './use-portada-api';

/**
 * Portada (spec `admin-content-management`, D3): lo que cambia durante la
 * búsqueda —titular, resumen, contacto, disponibilidad e idiomas— con la vista
 * previa del hero antes de guardar.
 */
export function PortadaPage() {
  const profile = useAdminProfile();

  return (
    <>
      <PageHeader
        title="Portada"
        description="El perfil base: lo primero que se lee en todos los links. Los cambios se ven en el sitio al guardar, sin correr el seed."
      />
      {profile.isPending && <LoadingRows rows={5} />}
      {profile.isError && (
        <ErrorPanel message={profile.error.message} onRetry={() => void profile.refetch()} />
      )}
      {profile.data && (
        // La clave reinicia el borrador cuando llega una versión guardada nueva.
        <ProfileEditor key={profile.data.id} initialDraft={toPortadaDraft(profile.data)} />
      )}
      <LanguagesSection />
    </>
  );
}

function ProfileEditor({ initialDraft }: { initialDraft: PortadaDraft }) {
  const { locale, setLocale } = useLocale();
  const replace = useReplaceProfile();
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<PortadaErrors>({});
  const liveErrors = useMemo(() => validatePortada(draft), [draft]);
  const preview = useProfilePreview(draft, locale, Object.keys(liveErrors).length === 0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const update = <K extends keyof PortadaDraft>(key: K, value: PortadaDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const localized = (value: LocalizedText) => ({ es: value.es, en: value.en ?? '' });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors(liveErrors);
    if (Object.keys(liveErrors).length > 0) return;
    replace.mutate(draft, {
      onSuccess: () => notifySuccess('Portada guardada: ya se ve en todos los links'),
      onError: (error) => notifyError(error),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={submit} noValidate className="surface flex flex-col gap-4 p-card">
        <h2 className="font-semibold">Identidad y contacto</h2>
        <TextField
          id="fullName"
          label="Nombre completo"
          required
          value={draft.fullName}
          error={errors.fullName}
          onChange={(value) => update('fullName', value)}
        />
        <LocalizedField
          label="Titular"
          required
          value={draft.headline}
          error={errors.headline}
          description="Lo muestran la home y los perfiles curados sin titular propio; uno con titular propio muestra el suyo."
          onChange={(value) => update('headline', localized(value))}
        />
        <LocalizedField
          label="Resumen"
          required
          multiline
          value={draft.summary}
          error={errors.summary}
          onChange={(value) => update('summary', localized(value))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="email"
            label="Email"
            type="email"
            required
            value={draft.email}
            error={errors.email}
            onChange={(value) => update('email', value)}
          />
          <TextField
            id="phone"
            label="Teléfono"
            value={draft.phone}
            onChange={(value) => update('phone', value)}
          />
          <TextField
            id="location"
            label="Ubicación"
            required
            value={draft.location}
            error={errors.location}
            onChange={(value) => update('location', value)}
          />
          <TextField
            id="timezone"
            label="Huso horario"
            value={draft.timezone}
            onChange={(value) => update('timezone', value)}
          />
          <TextField
            id="years"
            label="Años de experiencia"
            type="number"
            value={String(draft.yearsOfExperience)}
            error={errors.yearsOfExperience}
            onChange={(value) => update('yearsOfExperience', Number(value))}
          />
        </div>

        <h2 className="mt-2 font-semibold">Disponibilidad</h2>
        <p className="-mt-2 text-xs text-text-dim">
          La fecha de inicio aparece en el badge del hero. Vacío en los dos idiomas = sin dato.
        </p>
        <LocalizedField
          label="Fecha de inicio"
          value={draft.startDate}
          onChange={(value) => update('startDate', localized(value))}
        />
        <LocalizedField
          label="Modalidad"
          value={draft.modality}
          onChange={(value) => update('modality', localized(value))}
        />
        <LocalizedField
          label="Tipo de contrato"
          value={draft.contractType}
          onChange={(value) => update('contractType', localized(value))}
        />

        <div className="flex items-center justify-end gap-2">
          {dirty && <span className="text-xs text-text-dim">Cambios sin guardar</span>}
          <Button type="submit" disabled={replace.isPending || !dirty}>
            <Save aria-hidden />
            {replace.isPending ? 'Guardando…' : 'Guardar portada'}
          </Button>
        </div>
      </form>

      <HeroPreview
        data={preview.data}
        isFetching={preview.isFetching}
        error={preview.error}
        invalid={Object.keys(liveErrors).length > 0}
        locale={locale}
        onLocaleChange={setLocale}
      />
    </div>
  );
}

/** Un perfil curado mínimo alrededor del perfil base: lo único que el hero lee de él. */
function heroData(profile: ProfilePreview): CuratedProfile {
  return {
    slug: 'all',
    title: '',
    headline: '',
    description: '',
    roleType: '',
    techFocus: null,
    accentColor: '',
    layout: 'classic',
    visibility: 'PUBLIC',
    sections: ['hero'],
    hiddenSections: [],
    theme: null,
    profile,
    experiences: [],
    skillCategories: [],
    projects: [],
    education: [],
    certifications: [],
    socialLinks: [],
  };
}

interface HeroPreviewProps {
  data: ProfilePreview | undefined;
  isFetching: boolean;
  error: Error | null;
  invalid: boolean;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

/** El hero de la vista pública, con el borrador resuelto por el backend (D4). */
function HeroPreview({
  data,
  isFetching,
  error,
  invalid,
  locale,
  onLocaleChange,
}: HeroPreviewProps) {
  return (
    <section aria-label="Vista previa del hero" className="flex flex-col gap-3 lg:sticky lg:top-20">
      <header className="flex items-center gap-2">
        <h2 className="font-semibold">Vista previa</h2>
        {isFetching && (
          <span className="flex items-center gap-1 text-xs text-text-dim" role="status">
            <RefreshCw className="size-3 animate-spin" aria-hidden />
            actualizando
          </span>
        )}
        <span className="ml-auto text-xs text-text-dim">sin guardar</span>
        {/* El idioma de la vista previa: el mismo `?lang=` que usa el sitio. */}
        <Tabs value={locale} onValueChange={(next) => onLocaleChange(next as Locale)}>
          <TabsList className="h-7" aria-label="Idioma de la vista previa">
            <TabsTrigger value="es" className="px-2 py-0.5 text-xs uppercase">
              es
            </TabsTrigger>
            <TabsTrigger value="en" className="px-2 py-0.5 text-xs uppercase">
              en
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      {invalid && (
        <p className="surface px-4 py-3 text-sm text-text-muted">
          Completá los campos obligatorios para ver la vista previa.
        </p>
      )}
      {error && (
        <p role="alert" className="surface px-4 py-3 text-sm text-destructive">
          No se pudo generar la vista previa: {error.message}
        </p>
      )}
      <div className="overflow-hidden rounded-theme border border-border px-6" data-testid="hero-preview">
        {data ? (
          <Hero data={heroData(data)} />
        ) : (
          <div className="flex flex-col gap-3 py-6">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </div>
    </section>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
}

function TextField({ id, label, value, onChange, type = 'text', required, error }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-brand"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Idiomas (D2: cuelgan del perfil, se editan acá con su propia API) ──────
interface LanguageDraft {
  id?: string;
  name: string;
  nameI18n: LocalizedText;
  level: string;
  detail: LocalizedText;
}

const EMPTY_LANGUAGE: LanguageDraft = {
  name: '',
  nameI18n: { es: '', en: '' },
  level: '',
  detail: { es: '', en: '' },
};

function editableText(value: unknown): LocalizedText {
  if (value == null) return { es: '', en: '' };
  if (typeof value === 'string') return { es: value, en: '' };
  const text = value as LocalizedText;
  return { es: text.es ?? '', en: text.en ?? '' };
}

/** Bilingüe opcional: vacío en los dos idiomas → `null`. */
function optionalPayload(value: LocalizedText): LocalizedText | null {
  const payload = toLocalizedPayload(value);
  return payload.es || payload.en ? payload : null;
}

function LanguagesSection() {
  const languages = useLanguages();
  const save = useSaveLanguage();
  const remove = useDeleteLanguage();
  const [draft, setDraft] = useState<LanguageDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const edit = (language: AdminLanguage) =>
    setDraft({
      id: language.id,
      name: language.name,
      nameI18n: editableText(language.nameI18n),
      level: language.level,
      detail: editableText(language.detail),
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim() || !draft.level.trim()) {
      setError('El nombre y el nivel son obligatorios');
      return;
    }
    setError(null);
    save.mutate(
      {
        id: draft.id,
        body: {
          name: draft.name.trim(),
          nameI18n: optionalPayload(draft.nameI18n),
          level: draft.level.trim(),
          detail: optionalPayload(draft.detail),
        },
      },
      {
        onSuccess: () => {
          notifySuccess(draft.id ? 'Idioma actualizado' : 'Idioma agregado');
          setDraft(null);
        },
        onError: (err) => notifyError(err),
      },
    );
  };

  return (
    <section aria-label="Idiomas" className="surface mt-6 flex flex-col gap-3 p-card">
      <header className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold">Idiomas</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            setDraft({ ...EMPTY_LANGUAGE });
          }}
        >
          <Plus aria-hidden />
          Nuevo idioma
        </Button>
      </header>

      {languages.isPending && <LoadingRows rows={2} />}
      {languages.isError && (
        <ErrorPanel message={languages.error.message} onRetry={() => void languages.refetch()} />
      )}
      {languages.data?.length === 0 && (
        <EmptyState title="Sin idiomas" description="Agregá los idiomas que hablás y su nivel." />
      )}
      {languages.data && languages.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {languages.data.map((language) => {
            const shown = es(editableText(language.nameI18n)) || language.name;
            return (
              <li key={language.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">
                  {shown} <span className="text-text-dim">· {language.level}</span>
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Editar ${shown}`}
                  onClick={() => edit(language)}
                >
                  <Pencil aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="icon-sm" aria-label={`Borrar ${shown}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  title="Borrar idioma"
                  description={`Se borrará "${shown}" del perfil base y de todos los links.`}
                  onConfirm={() =>
                    remove.mutate(language.id, {
                      onSuccess: () => notifySuccess('Idioma borrado'),
                      onError: (err) => notifyError(err, 'No se pudo borrar'),
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar idioma' : 'Nuevo idioma'}</DialogTitle>
            <DialogDescription>Se muestra en el perfil base de todos los links.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <TextField
                id="language-name"
                label="Nombre"
                required
                value={draft.name}
                onChange={(name) => setDraft({ ...draft, name })}
              />
              <LocalizedField
                label="Nombre mostrado"
                description="Opcional: el nombre en cada idioma (por ejemplo Inglés / English)."
                value={draft.nameI18n}
                onChange={(value) => setDraft({ ...draft, nameI18n: editableText(value) })}
              />
              <TextField
                id="language-level"
                label="Nivel"
                required
                value={draft.level}
                onChange={(level) => setDraft({ ...draft, level })}
              />
              <LocalizedField
                label="Detalle"
                value={draft.detail}
                onChange={(value) => setDraft({ ...draft, detail: editableText(value) })}
              />
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
