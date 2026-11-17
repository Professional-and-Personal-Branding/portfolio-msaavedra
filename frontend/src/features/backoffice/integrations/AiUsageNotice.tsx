import { Link } from 'react-router';
import { AI_NOTICE_TEXT } from './ai-text';
import { useAiUsage } from './use-ai-usage-api';

/**
 * Aviso del Dashboard (change `add-ai-foundation`, D18): la pantalla de IA no tiene ítem en la
 * barra, así que si el tope del mes se alcanzó o Anthropic cortó por su spend limit, el Dashboard
 * lo señala con un enlace. Con cualquier otro estado, mientras carga o si la consulta falla, no se
 * muestra y el resto del Dashboard sigue.
 */
export function AiUsageNotice() {
  const usage = useAiUsage();
  const state = usage.data?.state;
  if (state !== 'EXHAUSTED' && state !== 'PROVIDER_BLOCKED') return null;
  return (
    <section
      aria-label="Aviso de IA"
      className="surface mb-6 flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
    >
      <p className="font-medium">{AI_NOTICE_TEXT}</p>
      <Link to="/admin/integraciones" className="font-medium text-brand-ink hover:underline">
        Ver integraciones
      </Link>
    </section>
  );
}
