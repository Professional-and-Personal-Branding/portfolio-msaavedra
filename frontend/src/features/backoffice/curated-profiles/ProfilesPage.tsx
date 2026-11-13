import {
  Archive,
  Copy,
  ExternalLink,
  Eye,
  FileSearch,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { formatCount } from '@/shared/i18n/plural';
import { profilePath } from '@/shared/lib/profile-link';
import type { AdminCuratedProfile, Visibility } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import {
  notifyError,
  notifySuccess,
  useCuratedProfilesAdmin,
  useDeleteCuratedProfile,
  useDuplicateCuratedProfile,
} from '../shared/use-admin-api';

const VISIBILITY_META: Record<Visibility, { label: string; icon: typeof Eye }> = {
  PUBLIC: { label: 'Público', icon: Eye },
  PRIVATE: { label: 'Privado', icon: Lock },
  PROTECTED: { label: 'Protegido', icon: Shield },
};

/** Listado de perfiles curados (spec `curated-profile-builder`). */
export function ProfilesPage() {
  const profiles = useCuratedProfilesAdmin();
  const remove = useDeleteCuratedProfile();
  const duplicate = useDuplicateCuratedProfile();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Perfiles curados"
        description="Cada perfil es una vista filtrada del portafolio, con su propio link para compartir."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void navigate('/admin/perfiles/desde-vacante')}
            >
              <FileSearch aria-hidden />
              Desde una vacante
            </Button>
            <Button onClick={() => void navigate('/admin/perfiles/nuevo')}>
              <Plus aria-hidden />
              Nuevo perfil
            </Button>
          </>
        }
      />

      {profiles.isPending && <LoadingRows />}
      {profiles.isError && (
        <ErrorPanel message={profiles.error.message} onRetry={() => void profiles.refetch()} />
      )}
      {profiles.data?.length === 0 && (
        <EmptyState
          title="Todavía no hay perfiles curados"
          description="Creá el primero para generar un link a medida de una vacante."
        />
      )}

      {profiles.data && profiles.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {profiles.data.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              onDelete={() =>
                remove.mutate(profile.id, {
                  onSuccess: () => notifySuccess('Perfil borrado'),
                  onError: (error) => notifyError(error, 'No se pudo borrar'),
                })
              }
              onDuplicate={() =>
                duplicate.mutate(profile.id, {
                  onSuccess: (copy) => {
                    notifySuccess(`Duplicado como /${copy.slug}: privado hasta que lo publiques`);
                    void navigate(`/admin/perfiles/${copy.id}`);
                  },
                  onError: (error) => notifyError(error, 'No se pudo duplicar'),
                })
              }
            />
          ))}
        </ul>
      )}
    </>
  );
}

interface ProfileRowProps {
  profile: AdminCuratedProfile;
  onDelete: () => void;
  onDuplicate: () => void;
}

function ProfileRow({ profile, onDelete, onDuplicate }: ProfileRowProps) {
  const meta = VISIBILITY_META[profile.visibility];
  return (
    <li className="surface flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {profile.title.es}
          <Badge variant="outline" className="gap-1">
            <meta.icon className="size-3" aria-hidden />
            {meta.label}
          </Badge>
          {profile.archivedAt && (
            <Badge variant="outline" className="gap-1 text-text-muted">
              <Archive className="size-3" aria-hidden />
              Archivado
            </Badge>
          )}
          {!profile.listed && (
            <Badge variant="outline" className="gap-1 text-text-muted">
              <EyeOff className="size-3" aria-hidden />
              No enumerado
            </Badge>
          )}
        </p>
        <p className="truncate text-sm text-text-muted">
          /{profile.slug}
          {profile.roleType?.es ? ` · ${profile.roleType.es}` : ''}
          {profile.techFocus ? ` · ${profile.techFocus}` : ''}
        </p>
      </div>

      <span className="text-xs text-text-dim">
        {formatCount(profile.views, { one: 'visita', other: 'visitas' })}
      </span>

      <Button asChild variant="outline" size="icon-sm">
        <Link
          to={profilePath(profile.slug)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir ${profile.slug} en el portafolio`}
        >
          <ExternalLink aria-hidden />
        </Link>
      </Button>

      <Button asChild variant="outline" size="icon-sm">
        <Link to={`/admin/perfiles/${profile.id}`} aria-label={`Editar ${profile.slug}`}>
          <Pencil aria-hidden />
        </Link>
      </Button>

      <ConfirmDialog
        trigger={
          <Button variant="outline" size="icon-sm" aria-label={`Duplicar ${profile.slug}`}>
            <Copy aria-hidden />
          </Button>
        }
        title="Duplicar perfil curado"
        description={`Se crea una copia de "${profile.title.es}" con toda su configuración. Nace privada y sin enumerar, sin token ni visitas, y se abre para que la ajustes.`}
        confirmLabel="Duplicar"
        onConfirm={onDuplicate}
      />

      <ConfirmDialog
        trigger={
          <Button variant="outline" size="icon-sm" aria-label={`Borrar ${profile.slug}`}>
            <Trash2 aria-hidden />
          </Button>
        }
        title="Borrar perfil curado"
        description={`Se borrará "${profile.title.es}" (/${profile.slug}) y ${profile.views === 1 ? 'su' : 'sus'} ${formatCount(profile.views, { one: 'visita registrada', other: 'visitas registradas' })}. Para retirarlo conservando las visitas, archivalo desde su pestaña Publicación.`}
        onConfirm={onDelete}
      />
    </li>
  );
}
