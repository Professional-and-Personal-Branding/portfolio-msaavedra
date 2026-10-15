import { EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type {
  AdminCertification,
  AdminEducation,
  CreateCertificationBody,
  CreateEducationBody,
} from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { notifyError, notifySuccess } from '../shared/use-admin-api';
import { CertificationForm, EducationForm } from './FormacionForms';
import {
  toCertificationValues,
  toEducationValues,
  type CertificationFormValues,
  type EducationFormValues,
} from './formacion-form';
import {
  useCertifications,
  useDeleteCertification,
  useDeleteEducation,
  useEducation,
  useSaveCertification,
  useSaveEducation,
} from './use-formacion-api';

interface Editing<V> {
  id?: string;
  values?: V;
  title: string;
}

/** Educación y certificaciones (spec `admin-content-management` § /admin/formacion). */
export function FormacionPage() {
  return (
    <>
      <PageHeader
        title="Formación"
        description="Títulos y certificaciones del sitio. Ocultá un item para sacarlo de la vista pública sin borrarlo."
      />
      <div className="flex flex-col gap-8">
        <EducationSection />
        <CertificationsSection />
      </div>
    </>
  );
}

function EducationSection() {
  const education = useEducation();
  const save = useSaveEducation();
  const remove = useDeleteEducation();
  const [editing, setEditing] = useState<Editing<EducationFormValues> | null>(null);

  const handleSubmit = (body: CreateEducationBody) => {
    save.mutate(
      { id: editing?.id, body },
      {
        onSuccess: () => {
          notifySuccess(editing?.id ? 'Formación actualizada' : 'Formación creada');
          setEditing(null);
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  const handleDelete = (item: AdminEducation) =>
    remove.mutate(item.id, {
      onSuccess: () => notifySuccess('Formación borrada'),
      onError: (error) => notifyError(error, 'No se pudo borrar'),
    });

  return (
    <Section
      label="Educación"
      action={
        <Button onClick={() => setEditing({ title: 'Nueva formación' })}>
          <Plus aria-hidden />
          Nueva formación
        </Button>
      }
    >
      {education.isPending && <LoadingRows rows={2} />}
      {education.isError && (
        <ErrorPanel message={education.error.message} onRetry={() => void education.refetch()} />
      )}
      {education.data?.length === 0 && (
        <EmptyState
          title="Todavía no hay formación cargada"
          description="Creá la primera para que aparezca en el sitio."
        />
      )}
      {education.data && education.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {education.data.map((item) => (
            <Row
              key={item.id}
              visible={item.visible}
              title={item.degree.es}
              subtitle={`${item.institution} · ${item.startDate} — ${
                item.inProgress ? 'en curso' : (item.endDate ?? '—')
              }`}
              order={item.order}
              deleteTitle="Borrar formación"
              deleteDescription={`Se borrará "${item.degree.es}" de ${item.institution}. Esta acción no se puede deshacer; si solo querés sacarla del sitio, ocultala.`}
              onEdit={() =>
                setEditing({
                  id: item.id,
                  values: toEducationValues(item),
                  title: `Editar ${item.degree.es}`,
                })
              }
              onDelete={() => handleDelete(item)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <EducationForm
          key={editing.id ?? 'new'}
          open
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

function CertificationsSection() {
  const certifications = useCertifications();
  const save = useSaveCertification();
  const remove = useDeleteCertification();
  const [editing, setEditing] = useState<Editing<CertificationFormValues> | null>(null);

  const handleSubmit = (body: CreateCertificationBody) => {
    save.mutate(
      { id: editing?.id, body },
      {
        onSuccess: () => {
          notifySuccess(editing?.id ? 'Certificación actualizada' : 'Certificación creada');
          setEditing(null);
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  const handleDelete = (item: AdminCertification) =>
    remove.mutate(item.id, {
      onSuccess: () => notifySuccess('Certificación borrada'),
      onError: (error) => notifyError(error, 'No se pudo borrar'),
    });

  return (
    <Section
      label="Certificaciones"
      action={
        <Button onClick={() => setEditing({ title: 'Nueva certificación' })}>
          <Plus aria-hidden />
          Nueva certificación
        </Button>
      }
    >
      {certifications.isPending && <LoadingRows rows={2} />}
      {certifications.isError && (
        <ErrorPanel
          message={certifications.error.message}
          onRetry={() => void certifications.refetch()}
        />
      )}
      {certifications.data?.length === 0 && (
        <EmptyState
          title="Todavía no hay certificaciones"
          description="Creá la primera para que aparezca en el sitio."
        />
      )}
      {certifications.data && certifications.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {certifications.data.map((item) => (
            <Row
              key={item.id}
              visible={item.visible}
              title={item.name.es}
              subtitle={item.year ? `${item.issuer} · ${item.year}` : item.issuer}
              order={item.order}
              deleteTitle="Borrar certificación"
              deleteDescription={`Se borrará "${item.name.es}". Esta acción no se puede deshacer; si solo querés sacarla del sitio, ocultala.`}
              onEdit={() =>
                setEditing({
                  id: item.id,
                  values: toCertificationValues(item),
                  title: `Editar ${item.name.es}`,
                })
              }
              onDelete={() => handleDelete(item)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <CertificationForm
          key={editing.id ?? 'new'}
          open
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
        <h2 className="text-lg font-semibold text-brand-2-ink">{label}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

interface RowProps {
  visible: boolean;
  title: string;
  subtitle: string;
  order: number;
  deleteTitle: string;
  deleteDescription: string;
  onEdit: () => void;
  onDelete: () => void;
}

function Row({
  visible,
  title,
  subtitle,
  order,
  deleteTitle,
  deleteDescription,
  onEdit,
  onDelete,
}: RowProps) {
  return (
    <li
      data-visible={visible}
      className={`surface flex flex-wrap items-center gap-3 px-4 py-3 ${visible ? '' : 'opacity-60'}`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
          {!visible && (
            <Badge variant="secondary" className="gap-1">
              <EyeOff className="size-3" aria-hidden />
              Oculto
            </Badge>
          )}
        </p>
        <p className="truncate text-sm text-text-muted">{subtitle}</p>
      </div>

      <span className="text-xs text-text-dim">orden {order}</span>

      <Button variant="outline" size="icon-sm" aria-label={`Editar ${title}`} onClick={onEdit}>
        <Pencil aria-hidden />
      </Button>

      <ConfirmDialog
        trigger={
          <Button variant="outline" size="icon-sm" aria-label={`Borrar ${title}`}>
            <Trash2 aria-hidden />
          </Button>
        }
        title={deleteTitle}
        description={deleteDescription}
        onConfirm={onDelete}
      />
    </li>
  );
}
