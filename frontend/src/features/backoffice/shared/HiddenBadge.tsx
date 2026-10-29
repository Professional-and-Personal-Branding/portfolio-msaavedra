import { EyeOff } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';

/** Insignia del ítem oculto en las listas del panel: texto + ícono, no depende del color. */
export function HiddenBadge({ feminine = false }: { feminine?: boolean }) {
  return (
    <Badge variant="secondary" className="gap-1">
      <EyeOff className="size-3" aria-hidden />
      {feminine ? 'Oculta' : 'Oculto'}
    </Badge>
  );
}
