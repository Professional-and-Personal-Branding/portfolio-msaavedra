export const SHARE_CODE_GENERATOR = Symbol('ShareCodeGenerator');

/** Puerto del generador de códigos de enlace: la aleatoriedad criptográfica la pone el adaptador. */
export interface ShareCodeGenerator {
  /** Un código nuevo de 10 símbolos del alfabeto (no garantiza unicidad: lo hace el índice). */
  generate(): string;
}
