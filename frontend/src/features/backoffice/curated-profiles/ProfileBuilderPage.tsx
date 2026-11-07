import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Save,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import type { Locale } from '@/shared/i18n/locale';
import { formatCount } from '@/shared/i18n/plural';
import { isHttpError } from '@/shared/lib/api-client';
import { profilePath } from '@/shared/lib/profile-link';
import { cn } from '@/shared/lib/utils';
import { LAYOUT_NAMES } from '@/themes/layouts';
import { ThemeCustomizerPanel } from '../theme-customizer/ThemeCustomizerPanel';
import { baseTokensOf, diffTokens, effectiveTokens } from '../theme-customizer/theme-draft';
import type { AdminCuratedProfile, Visibility } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { UnsavedChangesDialog } from '../shared/UnsavedChangesDialog';
import { useUnsavedChangesGuard } from '../shared/use-unsaved-changes-guard';
import { ChipListField } from '../shared/fields/ChipListField';
import { LocalizedField } from '../shared/fields/LocalizedField';
import { PageHeader } from '../shared/PageHeader';
import { ErrorPanel, LoadingRows } from '../shared/states';
import {
  notifyError,
  notifySuccess,
  useArchiveCuratedProfile,
  useCuratedProfilesAdmin,
  useExperiences,
  useSaveCuratedProfile,
  useSkillCategories,
  useThemes,
} from '../shared/use-admin-api';
import { useProjects } from '../proyectos/use-proyectos-api';
import { MissingTranslationsNotice } from './MissingTranslationsNotice';
import { PreviewPanel } from './PreviewPanel';
import { ResumeDownload } from './ResumeDownload';
import { ExperiencesBlock, ProjectsBlock, SkillsBlock } from './SelectionBlocks';
import { ShareLinksPanel } from './ShareLinksPanel';
import type { SavedProfileRef } from './share-link-url';
import { ShareOnLinkedInButton } from './ShareOnLinkedInButton';
import {
  allSections,
  EMPTY_DRAFT,
  moveSection,
  tagUniverse,
  toDraft,
  toProfileBody,
  validateDraft,
  type ProfileDraft,
} from './profile-draft';
import {
  orphanOverrideIds,
  removeOverrideIds,
  setOverride,
  type OverrideMode,
} from './selection-overrides';
import { usePreview } from './use-preview';

const VISIBILITIES: { value: Visibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Público' },
  { value: 'PRIVATE', label: 'Privado' },
  { value: 'PROTECTED', label: 'Protegido con token' },
];

/** Constructor de perfiles curados con preview en vivo (specs `curated-profile-builder` y `theme-customizer`). */
export function ProfileBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'nuevo' || id === undefined;
  const navigate = useNavigate();
  const profiles = useCuratedProfilesAdmin();

  if (isNew) return <ProfileEditor initialDraft={EMPTY_DRAFT} />;
  if (profiles.isPending) return <LoadingRows rows={6} />;
  if (profiles.isError) {
    return <ErrorPanel message={profiles.error.message} onRetry={() => void profiles.refetch()} />;
  }

  const saved = profiles.data.find((profile) => profile.id === id);
  if (!saved) {
    return (
      <ErrorPanel message="Ese perfil no existe" onRetry={() => void navigate('/admin/perfiles')} />
    );
  }

  // `key`: cambiar de perfil re-inicializa el borrador sin sincronizar con efectos.
  return <ProfileEditor key={saved.id} id={saved.id} saved={saved} initialDraft={toDraft(saved)} />;
}

interface ProfileEditorProps {
  id?: string;
  saved?: AdminCuratedProfile;
  initialDraft: ProfileDraft;
}

function ProfileEditor({ id, saved, initialDraft }: ProfileEditorProps) {
  const isNew = id === undefined;
  const navigate = useNavigate();
  const experiences = useExperiences();
  const categories = useSkillCategories();
  const projects = useProjects();
  const themes = useThemes();
  const save = useSaveCuratedProfile();
  const archive = useArchiveCuratedProfile();

  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  // Sucio = el cuerpo que enviaría Guardar difiere del último guardado (D3): deshacer a mano
  // o un espacio final que `toProfileBody` recorta vuelven a "limpio".
  const [baseline, setBaseline] = useState(() => JSON.stringify(toProfileBody(initialDraft)));
  const dirty = JSON.stringify(toProfileBody(draft)) !== baseline;
  const guard = useUnsavedChangesGuard(dirty);
  // Archivar no pasa por el borrador: tiene su propio endpoint y se aplica al instante.
  const [archivedAt, setArchivedAt] = useState<string | null>(saved?.archivedAt ?? null);
  const setArchived = (next: boolean) =>
    id &&
    archive.mutate(
      { id, archive: next },
      {
        onSuccess: (profile) => {
          setArchivedAt(profile.archivedAt);
          notifySuccess(next ? 'Perfil archivado: su link ya no resuelve' : 'Perfil desarchivado');
        },
        onError: (error) => notifyError(error, 'No se pudo cambiar el archivado'),
      },
    );
  // El link no resuelve si el perfil está archivado o es privado (la misma tabla de verdad del backend).
  const linkResolves = archivedAt === null && draft.visibility !== 'PRIVATE';
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({});
  const [copied, setCopied] = useState(false);

  // Estado de vista (D1): no entra en el borrador ni en el PATCH, y vuelve a 'es' al recargar.
  const [previewLocale, setPreviewLocale] = useState<Locale>('es');
  const preview = usePreview(draft, previewLocale);

  const baseTheme = themes.data?.find((theme) => theme.id === draft.themeId);
  const baseTokens = useMemo(() => baseTokensOf(baseTheme), [baseTheme]);
  const tokens = useMemo(
    () => effectiveTokens(baseTokens, draft.themeOverrides),
    [baseTokens, draft.themeOverrides],
  );
  const hasOverrides = draft.themeOverrides !== null;

  const tags = useMemo(
    () => tagUniverse(experiences.data, categories.data, projects.data, draft.filterTags),
    [experiences.data, categories.data, projects.data, draft.filterTags],
  );

  // Referencias a ítems borrados (D7): solo se informan con las tres listas cargadas, porque con
  // una ausente no se puede saber de qué lista era cada id.
  const orphans = useMemo(
    () =>
      experiences.data && categories.data && projects.data
        ? orphanOverrideIds(draft, experiences.data, categories.data, projects.data)
        : [],
    [draft, experiences.data, categories.data, projects.data],
  );

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /**
   * Alterna un valor en una lista partiendo SIEMPRE del estado vigente: varios
   * clics en la misma tanda de renderizado no se pisan entre sí.
   */
  const toggleIn = <K extends 'filterTags' | 'sectionsHidden'>(
    key: K,
    value: ProfileDraft[K][number],
  ) =>
    setDraft((current) => {
      const list: readonly ProfileDraft[K][number][] = current[key];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });

  /** Fija el override de un ítem partiendo del estado vigente (exclusión mutua, D5). */
  const applyOverride = (itemId: string, mode: OverrideMode) =>
    setDraft((current) => setOverride(current, itemId, mode));

  // Lo que los enlaces de seguimiento usan del perfil: siempre lo guardado, nunca el borrador.
  const savedRef: SavedProfileRef | undefined = saved
    ? {
        id: saved.id,
        slug: saved.slug,
        visibility: saved.visibility,
        accessToken: saved.accessToken,
        archivedAt,
      }
    : undefined;

  const publicUrl = `${globalThis.location?.origin ?? ''}${profilePath(draft.slug)}${
    draft.visibility === 'PROTECTED' && draft.accessToken
      ? `?token=${encodeURIComponent(draft.accessToken)}`
      : ''
  }`;

  const handleSave = () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      notifyError(new Error('Revisá los campos marcados'), 'Revisá los campos marcados');
      return;
    }
    const body = toProfileBody(draft);
    save.mutate(
      { id, body },
      {
        onSuccess: (result) => {
          // Antes del `navigate` del alta: el blocker lee la ref y no debe ver el estado viejo.
          guard.markSaved();
          setBaseline(JSON.stringify(body));
          notifySuccess(isNew ? 'Perfil creado' : 'Perfil guardado');
          if (isNew) void navigate(`/admin/perfiles/${result.id}`, { replace: true });
        },
        onError: (error) => {
          if (isHttpError(error, 409)) {
            setErrors({ slug: 'Ya existe un perfil con ese slug' });
          }
          notifyError(error);
        },
      },
    );
  };

  return (
    <>
      <UnsavedChangesDialog guard={guard} />
      <PageHeader
        title={isNew ? 'Nuevo perfil curado' : draft.title.es || 'Perfil curado'}
        description="Elegí qué entra, cómo se ve y con quién lo compartís. La vista previa usa los componentes reales del portafolio."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/perfiles">
                <ArrowLeft aria-hidden />
                Volver
              </Link>
            </Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              <Save aria-hidden />
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Tabs defaultValue="identidad" className="min-w-0">
          <TabsList>
            <TabsTrigger value="identidad">Identidad</TabsTrigger>
            <TabsTrigger value="seleccion">Selección</TabsTrigger>
            <TabsTrigger value="diseno">Diseño</TabsTrigger>
            <TabsTrigger value="publicacion">Publicación</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="surface flex flex-col gap-4 p-card">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">
                Slug<span className="text-brand-ink"> *</span>
              </Label>
              <Input
                id="slug"
                value={draft.slug}
                aria-invalid={errors.slug ? true : undefined}
                onChange={(event) => update('slug', event.target.value)}
              />
              {errors.slug ? (
                <p role="alert" className="text-xs text-danger-ink">
                  {errors.slug}
                </p>
              ) : (
                <p className="text-xs text-text-dim">
                  La URL pública será {profilePath(draft.slug || 'mi-perfil')}
                </p>
              )}
            </div>

            <LocalizedField
              label="Título"
              required
              value={draft.title}
              error={errors.title}
              onChange={(value) => update('title', { es: value.es, en: value.en ?? '' })}
            />
            <LocalizedField
              label="Titular"
              value={draft.headline}
              error={errors.headline}
              description="Opcional. Vacío, el hero muestra el titular del perfil base (Portada)."

              onChange={(value) => update('headline', { es: value.es, en: value.en ?? '' })}
            />
            <LocalizedField
              label="Descripción"
              multiline
              value={draft.description}
              onChange={(value) => update('description', { es: value.es, en: value.en ?? '' })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LocalizedField
                label="Tipo de rol"
                description="Agrupa el perfil en el menú público."
                value={draft.roleType}
                onChange={(value) => update('roleType', { es: value.es, en: value.en ?? '' })}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="techFocus">Tecnología destacada</Label>
                <Input
                  id="techFocus"
                  value={draft.techFocus}
                  placeholder=".NET"
                  onChange={(event) => update('techFocus', event.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seleccion" className="surface flex flex-col gap-5 p-card">
            <ChipListField
              label="Tags de filtrado"
              value={draft.filterTags}
              placeholder="dotnet"
              description="Sin tags entran todas las experiencias visibles."
              onChange={(value) => update('filterTags', value)}
            />

            {tags.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-text-dim">Tags disponibles en los datos</p>
                <ul className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = draft.filterTags.includes(tag);
                    return (
                      <li key={tag}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleIn('filterTags', tag)}
                          className={cn(
                            'chip transition-colors',
                            active && 'border-transparent bg-brand-gradient text-brand-foreground',
                          )}
                        >
                          {tag}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {orphans.length > 0 && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-theme-sm border border-border px-3 py-2 text-xs text-text-dim"
              >
                <span>
                  {orphans.length === 1
                    ? '1 referencia a un ítem que ya no existe'
                    : `${orphans.length} referencias a ítems que ya no existen`}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setDraft((current) => removeOverrideIds(current, orphans))}
                >
                  Quitar
                </Button>
              </div>
            )}

            <ExperiencesBlock draft={draft} query={experiences} onOverride={applyOverride} />
            <SkillsBlock draft={draft} query={categories} onOverride={applyOverride} />
            <ProjectsBlock draft={draft} query={projects} onOverride={applyOverride} />
          </TabsContent>

          <TabsContent value="diseno" className="surface flex flex-col gap-6 p-card">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="layout">Layout</Label>
              <Select value={draft.layout} onValueChange={(value) => update('layout', value)}>
                <SelectTrigger id="layout" aria-label="Layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name === 'classic' ? 'Clásico' : 'Lateral'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <section aria-label="Secciones">
              <p className="mb-2 text-sm font-semibold">Secciones</p>
              <ul className="flex flex-col gap-1">
                {allSections(draft.sectionsOrder).map((section, index, list) => {
                  const hidden = draft.sectionsHidden.includes(section);
                  return (
                    <li
                      key={section}
                      className="flex items-center gap-2 rounded-theme-sm border border-border px-3 py-2"
                    >
                      <span className="w-5 text-xs text-text-dim tabular-nums">{index + 1}</span>
                      <span
                        className={cn('flex-1 text-sm', hidden && 'text-text-dim line-through')}
                      >
                        {section}
                      </span>
                      <Switch
                        aria-label={`Mostrar ${section}`}
                        checked={!hidden}
                        onCheckedChange={() => toggleIn('sectionsHidden', section)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        aria-label={`Subir ${section}`}
                        disabled={index === 0}
                        onClick={() => update('sectionsOrder', moveSection(list, index, -1))}
                      >
                        <ChevronUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        aria-label={`Bajar ${section}`}
                        disabled={index === list.length - 1}
                        onClick={() => update('sectionsOrder', moveSection(list, index, 1))}
                      >
                        <ChevronDown aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-label="Tema">
              <p className="mb-3 text-sm font-semibold">Tema</p>
              <ThemeCustomizerPanel
                themes={themes.data ?? []}
                themeId={draft.themeId}
                tokens={tokens}
                hasOverrides={hasOverrides}
                onThemeChange={(themeId) =>
                  setDraft((current) => ({ ...current, themeId, themeOverrides: null }))
                }
                onTokensChange={(next) =>
                  update(
                    'themeOverrides',
                    (diffTokens(baseTokens, next) as Record<string, unknown> | null) ?? null,
                  )
                }
                onReset={() => update('themeOverrides', null)}
              />
            </section>
          </TabsContent>

          <TabsContent value="publicacion" className="surface flex flex-col gap-4 p-card">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visibility">Visibilidad</Label>
              <p className="text-xs text-text-dim">
                Decide <strong>quién puede abrir</strong> el perfil por su link.
              </p>
              <Select
                value={draft.visibility}
                onValueChange={(value) => update('visibility', value as Visibility)}
              >
                <SelectTrigger id="visibility" aria-label="Visibilidad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {draft.visibility === 'PROTECTED' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="accessToken">
                  Token de acceso<span className="text-brand-ink"> *</span>
                </Label>
                <Input
                  id="accessToken"
                  value={draft.accessToken}
                  aria-invalid={errors.accessToken ? true : undefined}
                  onChange={(event) => update('accessToken', event.target.value)}
                />
                {errors.accessToken && (
                  <p role="alert" className="text-xs text-danger-ink">
                    {errors.accessToken}
                  </p>
                )}
              </div>
            )}

            <section aria-label="Enumeración" className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="listed">Enumerar en la home y el sitemap</Label>
                <Switch
                  id="listed"
                  checked={draft.listed}
                  onCheckedChange={(checked) => update('listed', checked)}
                />
              </div>
              <p className="text-xs text-text-dim">
                Decide <strong>si se enumera</strong> en el menú de la home, el listado público y el
                sitemap. No cambia el acceso: un perfil no enumerado sigue abriendo por su link, que
                es lo que lo vuelve un envío dirigido.
              </p>
            </section>

            {id && (
              <section aria-label="Archivado" className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label>Archivado</Label>
                  {archivedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={archive.isPending}
                      onClick={() => setArchived(false)}
                    >
                      <ArchiveRestore aria-hidden />
                      Desarchivar
                    </Button>
                  ) : (
                    <ConfirmDialog
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={archive.isPending}
                        >
                          <Archive aria-hidden />
                          Archivar
                        </Button>
                      }
                      title="Archivar perfil curado"
                      description="El link deja de funcionar (responde 404) y el perfil sale del listado y del sitemap. Las visitas se conservan y siguen en el dashboard. Se puede desarchivar."
                      confirmLabel="Archivar"
                      onConfirm={() => setArchived(true)}
                    />
                  )}
                </div>
                <p className="text-xs text-text-dim">
                  Decide <strong>si sigue vivo</strong>.{' '}
                  {archivedAt
                    ? `Archivado el ${new Date(archivedAt).toLocaleDateString('es')}.`
                    : 'Es la forma de retirarlo sin perder su analítica, a diferencia de borrarlo.'}
                </p>
              </section>
            )}

            <div className="flex flex-col gap-2">
              <Label>Link público</Label>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-theme-sm border border-border bg-bg-soft px-3 py-2 text-xs">
                  {publicUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(publicUrl);
                    setCopied(true);
                    notifySuccess('Link copiado');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  Copiar
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ArrowUpRight aria-hidden />
                    Abrir
                  </a>
                </Button>
              </div>
              {!linkResolves && (
                <p role="status" className="flex items-start gap-1.5 text-xs text-danger-ink">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {archivedAt
                    ? 'Este link no resuelve: el perfil está archivado y responde 404.'
                    : 'Este link no resuelve: un perfil privado responde 404. Usalo para borradores.'}
                </p>
              )}
              <MissingTranslationsNotice
                data={preview.data}
                locale={previewLocale}
                pending={preview.isPlaceholderData}
              />
            </div>

            <ResumeDownload profile={savedRef} dirty={dirty} />

            <div className="flex flex-col gap-2">
              <Label>Compartir</Label>
              <ShareOnLinkedInButton profile={savedRef} />
            </div>

            <ShareLinksPanel profile={savedRef} dirty={dirty} />

            {saved && (
              <p className="text-xs text-text-dim">
                <Badge variant="outline">
                  {formatCount(saved.views, { one: 'visita', other: 'visitas' })}
                </Badge>
              </p>
            )}
          </TabsContent>
        </Tabs>

        <PreviewPanel
          data={preview.data}
          tokens={tokens}
          layout={draft.layout}
          isFetching={preview.isFetching}
          error={preview.error}
          locale={previewLocale}
          onLocaleChange={setPreviewLocale}
        />
      </div>
    </>
  );
}
