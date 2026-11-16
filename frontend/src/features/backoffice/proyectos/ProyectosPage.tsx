import { ExternalLink, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { isHttpError } from '@/shared/lib/api-client';
import type {
  AdminProject,
  AdminRepository,
  AdminSocialLink,
  CreateProjectBody,
  CreateRepositoryBody,
  CreateSocialLinkBody,
} from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { HiddenBadge } from '../shared/HiddenBadge';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { notifyError, notifySuccess } from '../shared/use-admin-api';
import { useEditParam } from '../shared/use-edit-param';
import { ProjectForm } from './ProjectForm';
import {
  toProjectValues,
  toRepositoryValues,
  toSocialLinkValues,
  type ProjectFormValues,
  type RepositoryFormValues,
  type SocialLinkFormValues,
} from './proyectos-form';
import { GithubSyncNotice, RepositoryEvidenceStatus } from './RepositoryEvidenceStatus';
import { RepositoryForm } from './RepositoryForm';
import { SocialLinkForm } from './SocialLinkForm';
import {
  useDeleteProject,
  useDeleteRepository,
  useDeleteSocialLink,
  useProjects,
  useRepositories,
  useSaveProject,
  useSaveRepository,
  useSaveSocialLink,
  useSocialLinks,
} from './use-proyectos-api';

interface Editing<T> {
  id?: string;
  values?: T;
  title: string;
}

/**
 * Proyectos destacados, repositorios de GitHub y enlaces sociales (spec `admin-content-management`).
 */
export function ProyectosPage() {
  // Cada sección abre su propio ítem con `?editar=<id>`; el aviso «El ítem ya no existe.» lo da la
  // página porque es la única que ve las tres listas (los hooks de datos comparten caché).
  const projects = useProjects();
  const repositories = useRepositories();
  const links = useSocialLinks();
  useEditParam({
    ready: projects.isSuccess && repositories.isSuccess && links.isSuccess,
    find: (id) =>
      projects.data?.some((item) => item.id === id) ||
      repositories.data?.some((item) => item.id === id) ||
      links.data?.some((item) => item.id === id)
        ? true
        : undefined,
    onFound: () => undefined,
  });
  return (
    <>
      <PageHeader
        title="Proyectos, repositorios y enlaces"
        description="Proyectos destacados, repositorios de GitHub y enlaces sociales que se muestran en la vista pública."
      />
      <div className="flex flex-col gap-8">
        <ProjectsSection />
        <RepositoriesSection />
        <SocialLinksSection />
      </div>
    </>
  );
}

// ── Proyectos destacados ────────────────────────────────────────────────────
function ProjectsSection() {
  const projects = useProjects();
  const save = useSaveProject();
  const remove = useDeleteProject();
  const [editing, setEditing] = useState<Editing<ProjectFormValues> | null>(null);

  const openEdit = (project: AdminProject) =>
    setEditing({
      id: project.id,
      values: toProjectValues(project),
      title: `Editar ${project.name}`,
    });
  useEditParam({
    ready: projects.isSuccess,
    find: (id) => projects.data?.find((item) => item.id === id),
    onFound: openEdit,
    reportMissing: false,
  });

  const handleSubmit = (body: CreateProjectBody) => {
    save.mutate(
      { id: editing?.id, body },
      {
        onSuccess: () => {
          notifySuccess(editing?.id ? 'Proyecto actualizado' : 'Proyecto creado');
          setEditing(null);
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  const handleDelete = (project: AdminProject) => {
    remove.mutate(project.id, {
      onSuccess: () => notifySuccess('Proyecto borrado'),
      onError: (error) => notifyError(error, 'No se pudo borrar'),
    });
  };

  return (
    <Section
      label="Proyectos destacados"
      action={
        <Button size="sm" onClick={() => setEditing({ title: 'Nuevo proyecto' })}>
          <Plus aria-hidden />
          Nuevo proyecto
        </Button>
      }
    >
      {projects.isPending && <LoadingRows rows={2} />}
      {projects.isError && (
        <ErrorPanel message={projects.error.message} onRetry={() => void projects.refetch()} />
      )}
      {projects.data?.length === 0 && (
        <EmptyState
          title="Todavía no hay proyectos"
          description="Creá el primero para mostrarlo en los perfiles curados."
        />
      )}

      {projects.data && projects.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {projects.data.map((project) => (
            <li
              key={project.id}
              data-visible={project.visible}
              className={`${project.visible ? 'surface' : 'surface-hidden'} flex flex-wrap items-center gap-3 px-4 py-3`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {project.name}
                  {!project.visible && <HiddenBadge />}
                </p>
                <p className="truncate text-sm text-text-muted">
                  {project.role.es} · {project.period}
                </p>
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-ink hover:underline"
                  >
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                    {project.url}
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-text-dim">Sin enlace</p>
                )}
                {project.tags.length > 0 && (
                  <p className="mt-1 truncate text-xs text-text-dim">{project.tags.join(' · ')}</p>
                )}
              </div>

              <span className="text-xs text-text-dim">orden {project.order}</span>

              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Editar ${project.name}`}
                onClick={() => openEdit(project)}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="icon-sm" aria-label={`Borrar ${project.name}`}>
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Borrar proyecto"
                description={`Se borrará "${project.name}". Esta acción no se puede deshacer.`}
                onConfirm={() => handleDelete(project)}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProjectForm
          key={editing.id ?? 'new'}
          title={editing.title}
          initialValues={editing.values}
          saving={save.isPending}
          onSubmit={handleSubmit}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </Section>
  );
}

// ── Repositorios destacados (add-featured-repositories, D12) ────────────────
function RepositoriesSection() {
  const repositories = useRepositories();
  const save = useSaveRepository();
  const remove = useDeleteRepository();
  const [editing, setEditing] = useState<Editing<RepositoryFormValues> | null>(null);
  // La URL que el servidor rechazó por repetida (409): el error va en el campo, no en un aviso.
  const [conflictUrl, setConflictUrl] = useState<string | null>(null);

  const openEdit = (repository: AdminRepository) => {
    setConflictUrl(null);
    setEditing({
      id: repository.id,
      values: toRepositoryValues(repository),
      title: `Editar ${repository.name}`,
    });
  };
  useEditParam({
    ready: repositories.isSuccess,
    find: (id) => repositories.data?.find((item) => item.id === id),
    onFound: openEdit,
    reportMissing: false,
  });

  const handleSubmit = (body: CreateRepositoryBody) => {
    save.mutate(
      { id: editing?.id, body },
      {
        onSuccess: () => {
          notifySuccess(editing?.id ? 'Repositorio actualizado' : 'Repositorio creado');
          setEditing(null);
        },
        onError: (error) => {
          if (isHttpError(error, 409)) setConflictUrl(body.url);
          else notifyError(error);
        },
      },
    );
  };

  const handleDelete = (repository: AdminRepository) => {
    remove.mutate(repository.id, {
      onSuccess: () => notifySuccess('Repositorio borrado'),
      onError: (error) => notifyError(error, 'No se pudo borrar'),
    });
  };

  return (
    <Section
      label="Repositorios destacados"
      action={
        <Button
          size="sm"
          onClick={() => {
            setConflictUrl(null);
            setEditing({ title: 'Nuevo repositorio' });
          }}
        >
          <Plus aria-hidden />
          Nuevo repositorio
        </Button>
      }
    >
      <GithubSyncNotice />
      {repositories.isPending && <LoadingRows rows={2} />}
      {repositories.isError && (
        <ErrorPanel
          message={repositories.error.message}
          onRetry={() => void repositories.refetch()}
        />
      )}
      {repositories.data?.length === 0 && (
        <EmptyState
          title="Todavía no hay repositorios"
          description="Cargá al menos dos para que la sección se muestre en los perfiles curados."
        />
      )}

      {repositories.data && repositories.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {repositories.data.map((repository) => (
            <li
              key={repository.id}
              data-visible={repository.visible}
              className={`${repository.visible ? 'surface' : 'surface-hidden'} flex flex-wrap items-center gap-3 px-4 py-3`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {repository.name}
                  {repository.language && (
                    <span className="text-xs font-normal text-text-dim">{repository.language}</span>
                  )}
                  {!repository.visible && <HiddenBadge />}
                </p>
                <p className="truncate text-sm text-text-muted">{repository.description.es}</p>
                <a
                  href={repository.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-ink hover:underline"
                >
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                  {repository.url}
                </a>
                <RepositoryEvidenceStatus evidence={repository.evidence} />
                {repository.tags.length > 0 && (
                  <p className="mt-1 truncate text-xs text-text-dim">
                    {repository.tags.join(' · ')}
                  </p>
                )}
              </div>

              <span className="text-xs text-text-dim">orden {repository.order}</span>

              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Editar repositorio ${repository.name}`}
                onClick={() => openEdit(repository)}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Borrar repositorio ${repository.name}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Borrar repositorio"
                description={`Se borrará "${repository.name}" de la lista. El repositorio en GitHub no se toca. Esta acción no se puede deshacer.`}
                onConfirm={() => handleDelete(repository)}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <RepositoryForm
          key={editing.id ?? 'new'}
          title={editing.title}
          initialValues={editing.values}
          evidence={repositories.data?.find((item) => item.id === editing.id)?.evidence ?? null}
          saving={save.isPending}
          conflictUrl={conflictUrl}
          onSubmit={handleSubmit}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </Section>
  );
}

// ── Enlaces sociales ────────────────────────────────────────────────────────
function SocialLinksSection() {
  const links = useSocialLinks();
  const save = useSaveSocialLink();
  const remove = useDeleteSocialLink();
  const [editing, setEditing] = useState<Editing<SocialLinkFormValues> | null>(null);

  const openEdit = (link: AdminSocialLink) =>
    setEditing({ id: link.id, values: toSocialLinkValues(link), title: `Editar ${link.label.es}` });
  useEditParam({
    ready: links.isSuccess,
    find: (id) => links.data?.find((item) => item.id === id),
    onFound: openEdit,
    reportMissing: false,
  });

  const handleSubmit = (body: CreateSocialLinkBody) => {
    save.mutate(
      { id: editing?.id, body },
      {
        onSuccess: () => {
          notifySuccess(editing?.id ? 'Enlace actualizado' : 'Enlace creado');
          setEditing(null);
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  const handleDelete = (link: AdminSocialLink) => {
    remove.mutate(link.id, {
      onSuccess: () => notifySuccess('Enlace borrado'),
      onError: (error) => notifyError(error, 'No se pudo borrar'),
    });
  };

  return (
    <Section
      label="Enlaces sociales"
      action={
        <Button size="sm" onClick={() => setEditing({ title: 'Nuevo enlace' })}>
          <Plus aria-hidden />
          Nuevo enlace
        </Button>
      }
    >
      {links.isPending && <LoadingRows rows={2} />}
      {links.isError && (
        <ErrorPanel message={links.error.message} onRetry={() => void links.refetch()} />
      )}
      {links.data?.length === 0 && (
        <EmptyState
          title="Todavía no hay enlaces sociales"
          description="Agregá GitHub, LinkedIn o el canal que quieras mostrar."
        />
      )}

      {links.data && links.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {links.data.map((link) => (
            <li
              key={link.id}
              data-visible={link.visible}
              className={`${link.visible ? 'surface' : 'surface-hidden'} flex flex-wrap items-center gap-3 px-4 py-3`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {link.label.es}
                  <span className="text-xs font-normal text-text-dim">{link.platform}</span>
                  {link.featured && (
                    <Badge variant="outline" className="gap-1 text-brand-ink">
                      <Star className="size-3" aria-hidden />
                      Destacado
                    </Badge>
                  )}
                  {!link.visible && <HiddenBadge />}
                </p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate text-sm text-text-muted hover:underline"
                >
                  <ExternalLink className="size-3 shrink-0" aria-hidden />@{link.handle}
                </a>
              </div>

              <span className="text-xs text-text-dim">orden {link.order}</span>

              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Editar enlace ${link.label.es}`}
                onClick={() => openEdit(link)}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Borrar enlace ${link.label.es}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Borrar enlace social"
                description={`Se borrará el enlace a ${link.label.es} y dejará de verse en la vista pública.`}
                onConfirm={() => handleDelete(link)}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <SocialLinkForm
          key={editing.id ?? 'new'}
          title={editing.title}
          initialValues={editing.values}
          saving={save.isPending}
          onSubmit={handleSubmit}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </Section>
  );
}

// ── Piezas comunes ──────────────────────────────────────────────────────────
function Section({
  label,
  action,
  children,
}: {
  label: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
