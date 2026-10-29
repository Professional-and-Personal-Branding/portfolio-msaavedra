import { Check, Copy, Link2, Pencil, TriangleAlert, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/utils';
import type { ShareLink } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { ErrorPanel, LoadingRows } from '../shared/states';
import {
  notifyError,
  notifySuccess,
  useCreateShareLink,
  useRenameShareLink,
  useRevokeShareLink,
  useShareLinks,
} from '../shared/use-admin-api';
import { PortalLinkCopy } from './PortalLinkCopy';
import {
  PORTAL_SUGGESTIONS,
  shareLinkUrl,
  urlContextOf,
  type SavedProfileRef,
  type ShareUrlContext,
} from './share-link-url';

const dateTime = (iso: string) => new Date(iso).toLocaleString('es');

interface ShareLinksPanelProps {
  /** `undefined` = perfil sin guardar. */
  profile: SavedProfileRef | undefined;
  /** Hay cambios sin guardar en el borrador: los links usan la última versión guardada. */
  dirty: boolean;
}

/**
 * Enlaces de seguimiento del perfil (D11 de `add-share-links`): uno por destinatario o portal,
 * con etiqueta, aperturas de personas y revocación. Revocar deja de atribuir, no corta el acceso.
 */
export function ShareLinksPanel({ profile, dirty }: ShareLinksPanelProps) {
  return (
    <section aria-labelledby="enlaces-seguimiento" className="flex flex-col gap-3">
      <div>
        <h3 id="enlaces-seguimiento" className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4" aria-hidden />
          Enlaces de seguimiento
        </h3>
        <p className="mt-1 text-xs text-text-dim">
          Un enlace por destinatario o portal: abre el mismo perfil, pero cada apertura de una
          persona se cuenta en su enlace. Las tuyas y las de bots no cuentan.
        </p>
      </div>

      {profile ? (
        <SavedShareLinks profile={profile} dirty={dirty} />
      ) : (
        <p role="status" className="text-xs text-text-dim">
          Guardá el perfil primero para crear enlaces de seguimiento.
        </p>
      )}
    </section>
  );
}

function SavedShareLinks({ profile, dirty }: { profile: SavedProfileRef; dirty: boolean }) {
  const links = useShareLinks(profile.id);
  const context = urlContextOf(profile);
  const resolves = profile.archivedAt === null && profile.visibility !== 'PRIVATE';

  return (
    <>
      {dirty && (
        <p role="status" className="text-xs text-text-dim">
          Hay cambios sin guardar: los links usan el slug, la visibilidad y el token guardados.
        </p>
      )}
      {!resolves && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {profile.archivedAt
            ? 'Los links no resuelven: el perfil está archivado y responde 404.'
            : 'Los links no resuelven: un perfil privado responde 404.'}
        </p>
      )}

      <CreateShareLinkForm profileId={profile.id} />

      {links.isPending && <LoadingRows rows={2} />}
      {links.isError && (
        <ErrorPanel message={links.error.message} onRetry={() => void links.refetch()} />
      )}
      {links.data &&
        (links.data.length === 0 ? (
          <p className="text-xs text-text-dim">
            Todavía no hay enlaces. Creá uno para saber quién abrió cada envío.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Enlaces del perfil">
            {sortForDisplay(links.data).map((link) => (
              <ShareLinkRow key={link.id} profileId={profile.id} link={link} context={context} />
            ))}
          </ul>
        ))}

      <PortalLinkCopy context={context} />
    </>
  );
}

/** Los activos primero (más recientes antes, como los devuelve la API) y los revocados al final. */
function sortForDisplay(links: ShareLink[]): ShareLink[] {
  return [
    ...links.filter((l) => l.revokedAt === null),
    ...links.filter((l) => l.revokedAt !== null),
  ];
}

function CreateShareLinkForm({ profileId }: { profileId: string }) {
  const create = useCreateShareLink(profileId);
  const [label, setLabel] = useState('');
  const [portal, setPortal] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    if (trimmed === '') return;
    create.mutate(
      { label: trimmed, ...(portal.trim() !== '' ? { portal: portal.trim() } : {}) },
      {
        onSuccess: () => {
          setLabel('');
          setPortal('');
          notifySuccess('Enlace creado');
        },
        onError: (error) => notifyError(error, 'No se pudo crear el enlace'),
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2" aria-label="Crear enlace">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="share-link-label">Etiqueta</Label>
        <Input
          id="share-link-label"
          value={label}
          maxLength={80}
          placeholder="Acme — María, RR. HH."
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="share-link-portal">Portal (opcional)</Label>
        <Input
          id="share-link-portal"
          value={portal}
          list="share-link-portals"
          maxLength={32}
          placeholder="linkedin"
          onChange={(event) => setPortal(event.target.value)}
        />
        <datalist id="share-link-portals">
          {PORTAL_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </div>
      <Button type="submit" size="sm" disabled={create.isPending || label.trim() === ''}>
        Crear enlace
      </Button>
    </form>
  );
}

function ShareLinkRow({
  profileId,
  link,
  context,
}: {
  profileId: string;
  link: ShareLink;
  context: ShareUrlContext;
}) {
  const rename = useRenameShareLink(profileId);
  const revoke = useRevokeShareLink(profileId);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(link.label);
  const [copied, setCopied] = useState(false);
  const revoked = link.revokedAt !== null;

  const saveLabel = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    if (trimmed === '' || trimmed === link.label) {
      setEditing(false);
      setLabel(link.label);
      return;
    }
    rename.mutate(
      { linkId: link.id, label: trimmed },
      {
        onSuccess: () => {
          setEditing(false);
          notifySuccess('Etiqueta actualizada');
        },
        onError: (error) => notifyError(error, 'No se pudo cambiar la etiqueta'),
      },
    );
  };

  const copy = () => {
    void navigator.clipboard?.writeText(shareLinkUrl(context, link.code));
    setCopied(true);
    notifySuccess('Link con código copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-theme-sm border border-border p-3',
        revoked && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form onSubmit={saveLabel} className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              aria-label={`Etiqueta del enlace ${link.label}`}
              value={label}
              maxLength={80}
              autoFocus
              onChange={(event) => setLabel(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={rename.isPending}>
              Guardar etiqueta
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cancelar"
              onClick={() => {
                setEditing(false);
                setLabel(link.label);
              }}
            >
              <X aria-hidden />
            </Button>
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{link.label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Renombrar el enlace ${link.label}`}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
            </Button>
          </>
        )}
        {link.portal && <Badge variant="outline">{link.portal}</Badge>}
        {revoked ? <Badge variant="outline">Revocado</Badge> : <Badge>Activo</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-dim">
        <span>
          <strong className="text-text tabular-nums">{link.opens}</strong>{' '}
          {link.opens === 1 ? 'apertura' : 'aperturas'}
        </span>
        <span>
          {link.lastOpenedAt ? `Última: ${dateTime(link.lastOpenedAt)}` : 'Sin aperturas todavía'}
        </span>
        {revoked && link.revokedAt && <span>Revocado el {dateTime(link.revokedAt)}</span>}
        <span className="ml-auto flex items-center gap-2">
          {!revoked && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Copiar el link de ${link.label}`}
                onClick={copy}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                Copiar link
              </Button>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Revocar el enlace ${link.label}`}
                    disabled={revoke.isPending}
                  >
                    Revocar
                  </Button>
                }
                title="Revocar enlace de seguimiento"
                description="El link sigue abriendo el perfil, pero sus visitas dejan de atribuirse a este enlace. Sus aperturas pasadas se conservan. La revocación no se deshace."
                confirmLabel="Revocar"
                onConfirm={() =>
                  revoke.mutate(link.id, {
                    onSuccess: () => notifySuccess('Enlace revocado'),
                    onError: (error) => notifyError(error, 'No se pudo revocar el enlace'),
                  })
                }
              />
            </>
          )}
        </span>
      </div>
    </li>
  );
}
