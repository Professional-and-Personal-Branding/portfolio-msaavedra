/** Un lenguaje de la tarjeta: nombre y porcentaje entero por bytes (D10). */
export interface RepositoryEvidenceLanguageOutput {
  name: string;
  percent: number;
}

/** Evidencia verificada contra GitHub que se publica (change `add-github-code-evidence`, D10). */
export interface RepositoryEvidenceOutput {
  stars: number;
  languages: RepositoryEvidenceLanguageOutput[];
  topics: string[];
  /** Instante ISO del último push, o `null`. */
  pushedAt: string | null;
  archived: boolean;
  /** Instante ISO de la última verificación contra GitHub. */
  verifiedAt: string;
}

export interface FeaturedRepositoryOutput {
  id: string;
  name: string;
  url: string;
  /** Lenguaje efectivo: el cargado a mano o, si falta, el principal verificado en GitHub (D9). */
  language: string | null;
  description: string;
  technologies: string[];
  tags: string[];
  order: number;
  /** `null` si no hay evidencia válida: la tarjeta queda como antes del change. */
  evidence: RepositoryEvidenceOutput | null;
}
