import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type { AdminExperience, CreateExperienceBody } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { HiddenBadge } from '../shared/HiddenBadge';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { useEditParam } from '../shared/use-edit-param';
import {
  notifyError,
  notifySuccess,
  useDeleteExperience,
  useExperiences,
  useSaveExperience,
} from '../shared/use-admin-api';
import { ExperienceForm } from './ExperienceForm';
import { toFormValues, type ExperienceFormValues } from './experience-form';

interface Editing {
  id?: string;
  values?: ExperienceFormValues;
  title: string;
}

/** CRUD visual de experiencias (spec `admin-content-management`). */
export function ExperiencesPage() {
  const experiences = useExperiences();
  const save = useSaveExperience();
  const remove = useDeleteExperience();
  const [editing, setEditing] = useState<Editing | null>(null);

  const openEdit = (experience: AdminExperience) =>
    setEditing({
      id: experience.id,
      values: toFormValues(experience),
      title: `Editar ${experience.company}`,
    });
  // `?editar=<id>` (enlace «Abrir» de la pantalla Revisión).
  useEditParam({
    ready: experiences.isSuccess,
    find: (id) => experiences.data?.find((experience) => experience.id === id),
    onFound: openEdit,
  });

  const handleSubmit = (body: CreateExperienceBody) => {
    save.mutate(
      { id: editing?.id, body },
      {
        onSuccess: () => {
          notifySuccess(editing?.id ? 'Experiencia actualizada' : 'Experiencia creada');
          setEditing(null);
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  const handleDelete = (experience: AdminExperience) => {
    remove.mutate(experience.id, {
      onSuccess: () => notifySuccess('Experiencia borrada'),
      onError: (error) => notifyError(error, 'No se pudo borrar'),
    });
  };

  return (
    <>
      <PageHeader
        title="Experiencias"
        description="Trayectoria laboral que alimenta la vista pública y los perfiles curados."
        actions={
          <Button onClick={() => setEditing({ title: 'Nueva experiencia' })}>
            <Plus aria-hidden />
            Nueva experiencia
          </Button>
        }
      />

      {experiences.isPending && <LoadingRows />}
      {experiences.isError && (
        <ErrorPanel
          message={experiences.error.message}
          onRetry={() => void experiences.refetch()}
        />
      )}

      {experiences.data?.length === 0 && (
        <EmptyState
          title="Todavía no hay experiencias"
          description="Creá la primera para empezar."
        />
      )}

      {experiences.data && experiences.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {experiences.data.map((experience) => (
            <li
              key={experience.id}
              data-visible={experience.visible}
              className={`${experience.visible ? 'surface' : 'surface-hidden'} flex flex-wrap items-center gap-3 px-4 py-3`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {experience.role.es}
                  {experience.current && (
                    <Badge variant="outline" className="text-success-ink">
                      Actual
                    </Badge>
                  )}
                  {!experience.visible && <HiddenBadge feminine />}
                </p>
                <p className="truncate text-sm text-text-muted">
                  {experience.company} · {experience.startDate.slice(0, 7)} —{' '}
                  {experience.endDate ? experience.endDate.slice(0, 7) : 'presente'}
                </p>
                {experience.tags.length > 0 && (
                  <p className="mt-1 truncate text-xs text-text-dim">
                    {experience.tags.join(' · ')}
                  </p>
                )}
              </div>

              <span className="text-xs text-text-dim">orden {experience.order}</span>

              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Editar ${experience.company}`}
                onClick={() => openEdit(experience)}
              >
                <Pencil aria-hidden />
              </Button>

              <ConfirmDialog
                trigger={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Borrar ${experience.company}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Borrar experiencia"
                description={`Se borrará "${experience.role.es}" en ${experience.company}. Esta acción no se puede deshacer.`}
                onConfirm={() => handleDelete(experience)}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ExperienceForm
          key={editing.id ?? 'new'}
          open
          title={editing.title}
          initialValues={editing.values}
          saving={save.isPending}
          onSubmit={handleSubmit}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </>
  );
}
