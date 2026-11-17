import { LocalizedText } from '../../../../shared/domain/i18n';
import { RepositoryEvidenceStatus } from '../../domain/value-objects/repository-evidence';

/** Evidencia CRUDA para el panel (D12): incluye lo que la vista pública no publica. */
export interface AdminRepositoryEvidenceOutput {
  status: RepositoryEvidenceStatus;
  /** `owner/repo` pedido en la última sincronización. */
  repoKey: string;
  stars: number | null;
  primaryLanguage: string | null;
  topics: string[];
  archived: boolean;
  /** `full_name` si GitHub movió el repositorio: el panel pide actualizar la URL. */
  movedTo: string | null;
  githubDescription: string | null;
  verifiedAt: string;
  changedAt: string;
  /** `true` si `repoKey` ya no coincide con la URL actual: hay que volver a sincronizar. */
  stale: boolean;
}

/** Salida del backoffice: la descripción SIN resolver (para editar ambos idiomas). */
export interface AdminFeaturedRepositoryOutput {
  id: string;
  name: string;
  url: string;
  language: string | null;
  description: LocalizedText | string;
  technologies: string[];
  tags: string[];
  order: number;
  visible: boolean;
  evidence: AdminRepositoryEvidenceOutput | null;
}
