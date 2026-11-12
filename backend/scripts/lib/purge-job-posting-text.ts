/**
 * Núcleo de `npm run job-postings:purge` (change `add-job-posting-intake`, D13): borra el texto
 * de las vacantes importadas cuyo plazo de 90 días venció y dice cuántas purgó. Es lo mismo que
 * hacen en forma perezosa al listar, leer o importar; sirve para correrlo a mano o, cuando
 * exista, desde un cron. Separado del script para probarlo con un repositorio simulado.
 *
 * Salida: 0 ok (también con 0 filas) · 1 falla al escribir en la base.
 */
export interface JobPostingPurger {
  purgeExpiredText(now: Date): Promise<number>;
}

export async function runJobPostingPurge(
  repo: JobPostingPurger,
  now: Date,
  out: { log: (line: string) => void; error: (line: string) => void },
): Promise<number> {
  try {
    const purged = await repo.purgeExpiredText(now);
    out.log(`Texto de vacantes purgado: ${purged}`);
    return 0;
  } catch (error) {
    out.error(
      `Error en job-postings:purge: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}
