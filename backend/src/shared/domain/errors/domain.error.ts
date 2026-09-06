/**
 * Error base del dominio. Lleva un `code` estable (para clientes y logs) y un
 * mensaje legible. No depende de ningún framework.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
