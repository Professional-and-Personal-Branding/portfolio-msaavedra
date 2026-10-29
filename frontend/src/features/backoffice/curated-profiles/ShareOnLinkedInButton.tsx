import { Share2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { notifyError, useLinkedInShareLink } from '../shared/use-admin-api';
import {
  linkedInDisabledReason,
  linkedInShareUrl,
  shareLinkUrl,
  urlContextOf,
  type SavedProfileRef,
} from './share-link-url';

/**
 * «Compartir en LinkedIn»: abre la página de compartir de LinkedIn con la URL del perfil y el
 * código de un enlace `LINKEDIN_POST`. No publica nada: LinkedIn muestra su editor.
 */
export function ShareOnLinkedInButton({ profile }: { profile: SavedProfileRef | undefined }) {
  const linkedIn = useLinkedInShareLink(profile?.id ?? '');
  const reason = linkedInDisabledReason(profile);

  const share = () => {
    if (!profile) return;
    // La pestaña se abre dentro del clic (si no, el bloqueador de ventanas la frena) y se
    // navega cuando llega el enlace; sin `opener`, la página de LinkedIn no controla al panel.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    linkedIn.mutate(undefined, {
      onSuccess: (link) => {
        const target = linkedInShareUrl(shareLinkUrl(urlContextOf(profile), link.code));
        if (tab) tab.location.href = target;
        else window.open(target, '_blank', 'noopener,noreferrer');
      },
      onError: (error) => {
        tab?.close();
        notifyError(error, 'No se pudo preparar el enlace para LinkedIn');
      },
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={reason !== null || linkedIn.isPending}
          aria-describedby={reason ? 'linkedin-reason' : undefined}
          onClick={share}
        >
          <Share2 aria-hidden />
          Compartir en LinkedIn
        </Button>
      </div>
      {reason && (
        <p id="linkedin-reason" className="text-xs text-text-dim">
          {reason}
        </p>
      )}
    </div>
  );
}
