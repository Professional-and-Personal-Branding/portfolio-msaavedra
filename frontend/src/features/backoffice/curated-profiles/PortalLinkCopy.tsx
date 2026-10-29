import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { notifySuccess } from '../shared/use-admin-api';
import { PORTAL_SUGGESTIONS, portalLinkUrl, type ShareUrlContext } from './share-link-url';

/**
 * Link genérico por portal (`?src=`), sin llamar a la API: para pegar en el perfil de un portal
 * donde no importa distinguir destinatarios. No crea ningún enlace de seguimiento.
 */
export function PortalLinkCopy({ context }: { context: ShareUrlContext }) {
  const [portal, setPortal] = useState<string>(PORTAL_SUGGESTIONS[0]);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(portalLinkUrl(context, portal));
    setCopied(true);
    notifySuccess('Link por portal copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <Label htmlFor="portal-link">Link genérico por portal</Label>
      <p className="text-xs text-text-dim">
        Cuenta las aperturas por portal sin distinguir destinatarios. No crea ningún enlace.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="portal-link"
          value={portal}
          onChange={(event) => setPortal(event.target.value)}
          className="h-9 rounded-theme-sm border border-border bg-bg px-3 text-sm"
        >
          {PORTAL_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion}>
              {suggestion}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          Copiar link por portal
        </Button>
      </div>
    </div>
  );
}
