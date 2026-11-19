/**
 * Núcleo de `npm run job-postings:purge` (change `add-job-posting-intake`, D13; simulación por
 * defecto desde `prepare-deploy-1-0-0`, D6): borra el texto de las vacantes importadas cuyo plazo
 * de 90 días venció y dice cuántas purgó. Es lo mismo que hacen en forma perezosa al listar, leer o
 * importar; sirve para la corrida mensual a mano (no hay cron). Sin `apply` solo cuenta, como
 * `views:reclassify` y `ai-runs:purge`. Separado del script para probarlo con un repositorio simulado.
 *
 * Salida: 0 ok (también con 0 filas) · 1 falla de la base.
 */
export interface JobPostingPurger {
  countExpiredText(now: Date): Promise<number>;
  purgeExpiredText(now: Date): Promise<number>;
}

export async function runJobPostingPurge(
  repo: JobPostingPurger,
  now: Date,
  options: { readonly apply: boolean },
  out: { log: (line: string) => void; error: (line: string) => void },
): Promise<number> {
  try {
    if (options.apply) {
      out.log(`Vacantes purgadas: ${await repo.purgeExpiredText(now)}`);
    } else {
      out.log(
        `Vacantes que se purgarían (simulación; usá --apply): ${await repo.countExpiredText(now)}`,
      );
    }
    return 0;
  } catch (error) {
    out.error(
      `Error en job-postings:purge: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}
