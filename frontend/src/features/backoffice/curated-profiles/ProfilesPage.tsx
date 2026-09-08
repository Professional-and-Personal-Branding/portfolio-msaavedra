import { ExternalLink, Eye, Lock, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
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
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Perfiles curados"
        description="Cada perfil es una vista filtrada del portafolio, con su propio link para compartir."
        actions={
          <Button onClick={() => void navigate('/admin/perfiles/nuevo')}>
            <Plus aria-hidden />
            Nuevo perfil
          </Button>
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
            />
          ))}
        </ul>
      )}
    </>
  );
}

function ProfileRow({ profile, onDelete }: { profile: AdminCuratedProfile; onDelete: () => void }) {
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
        </p>
        <p className="truncate text-sm text-text-muted">
          /{profile.slug}
          {profile.roleType?.es ? ` · ${profile.roleType.es}` : ''}
          {profile.techFocus ? ` · ${profile.techFocus}` : ''}
        </p>
      </div>

      <span className="text-xs text-text-dim">{profile.views} visitas</span>

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
          <Button variant="outline" size="icon-sm" aria-label={`Borrar ${profile.slug}`}>
            <Trash2 aria-hidden />
          </Button>
        }
        title="Borrar perfil curado"
        description={`Se borrará "${profile.title.es}" (/${profile.slug}) y sus ${profile.views} visitas registradas.`}
        onConfirm={onDelete}
      />
    </li>
  );
}
