/**
 * Tipo de una visita al perfil público (spec `profile-view-analytics`, change
 * `classify-profile-views`, D1). Solo las `HUMAN` suman en `views` y en el
 * agregado; las `OWNER` y `BOT` se guardan igual para no perder el desglose.
 */
export type ViewKind = 'HUMAN' | 'OWNER' | 'BOT';

/** Los tres tipos, en el orden fijo en que se informan (`byKind`). */
export const VIEW_KINDS: readonly ViewKind[] = ['HUMAN', 'OWNER', 'BOT'];
