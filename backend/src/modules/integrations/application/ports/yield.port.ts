export const YIELD = Symbol('YIELD');

/** Cede el turno al event loop entre dos trabajos (D5). Inyectable para los tests. */
export type Yield = () => Promise<void>;

export const setImmediateYield: Yield = () => new Promise<void>((resolve) => setImmediate(resolve));
