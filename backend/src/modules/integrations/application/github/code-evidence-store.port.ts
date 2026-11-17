import { RepositoryEvidence } from '../../../featured-repository/domain/value-objects/repository-evidence';

export const CODE_EVIDENCE_STORE = Symbol('CODE_EVIDENCE_STORE');

/** Un repositorio destacado a verificar (también los ocultos: nunca se muestran, pero se verifican). */
export interface EvidenceTarget {
  readonly featuredRepositoryId: string;
  readonly url: string;
  readonly order: number;
  /** Los ocultos se verifican igual, pero después de los visibles (tope por trabajo). */
  readonly visible: boolean;
}

/**
 * Puerto de la tabla `RepositoryEvidence` y de la limpieza de snapshots (D2). Es el ÚNICO camino
 * de escritura de la evidencia: lo implementa `PrismaCodeEvidenceStore`.
 */
export interface CodeEvidenceStore {
  /** Todos los repositorios destacados por `order` y `id`. */
  listTargets(): Promise<EvidenceTarget[]>;
  find(featuredRepositoryId: string): Promise<RepositoryEvidence | null>;
  /** Crea o reemplaza la evidencia. `false` si el repositorio se borró mientras corría la sincronización. */
  save(featuredRepositoryId: string, evidence: RepositoryEvidence): Promise<boolean>;
  /** Borra los snapshots `github` cuya clave de recurso no está entre `keepResourceKeys`. */
  pruneSnapshots(keepResourceKeys: readonly string[]): Promise<void>;
}
