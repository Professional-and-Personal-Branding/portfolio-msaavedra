import { Link } from 'react-router';
import { needsAttention } from './integration-text';
import { useIntegrations } from './use-integrations-api';

export const ATTENTION_MESSAGE = 'Hay integraciones que requieren atención';

/**
 * Aviso del Dashboard (D25 de `add-integrations-foundation`): la pantalla de integraciones no
 * tiene ítem en la barra, así que si una sincronización lleva más de 48 h sin una corrida
 * exitosa o hay un trabajo fallido, el Dashboard la señala con un enlace. Si la consulta falla,
 * carga o no hay nada que avisar, no se muestra y el resto del Dashboard sigue.
 */
export function IntegrationsNotice() {
  const integrations = useIntegrations();
  if (!integrations.data || !needsAttention(integrations.data.providers)) return null;
  return (
    <section
      aria-label="Aviso de integraciones"
      className="surface mb-6 flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
    >
      <p className="font-medium">{ATTENTION_MESSAGE}</p>
      <Link to="/admin/integraciones" className="font-medium text-brand-ink hover:underline">
        Ver integraciones
      </Link>
    </section>
  );
}
