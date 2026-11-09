import { Link } from 'react-router';
import { summaryLine } from '../applications/summary-line';
import { useApplicationSummary } from '../applications/use-applications-api';

/**
 * Franja de una línea sobre los totales del dashboard (D12 de `add-application-tracking`): el
 * estado actual de las postulaciones, que no depende del rango de fechas. Si la consulta falla
 * o todavía carga, no se muestra y el resto del dashboard sigue.
 */
export function ApplicationsStrip() {
  const summary = useApplicationSummary();
  if (!summary.data) return null;
  return (
    <section
      aria-label="Resumen de postulaciones, estado actual"
      className="surface mb-6 flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
    >
      <p className="font-medium">{summaryLine(summary.data)}</p>
      <Link to="/admin/postulaciones" className="font-medium text-brand-ink hover:underline">
        Ver postulaciones
      </Link>
    </section>
  );
}
