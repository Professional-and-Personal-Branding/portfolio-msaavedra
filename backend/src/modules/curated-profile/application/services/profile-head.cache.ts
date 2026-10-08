/** Cuánto vive un fragmento: lo que tarda en verse una edición del perfil en las vistas previas. */
export const PROFILE_HEAD_TTL_MS = 60_000;
/** Tope de entradas: los perfiles son decenas; el tope solo existe para que la memoria no crezca sin fin. */
export const PROFILE_HEAD_MAX_ENTRIES = 200;

/**
 * Caché en memoria del fragmento de head ya renderizado (spec `public-seo`).
 * La ruta está exenta del límite de peticiones porque el borde la pide en cada
 * carga de HTML; sin caché, cada petición —legítima o no— recompondría el perfil
 * contra la base. Con ella, las repetidas cuestan una lectura de mapa.
 *
 * Solo guarda perfiles que resolvieron: un slug inexistente no entra, para que
 * pedir slugs al azar no desaloje a los reales. Al llenarse, sale el más viejo.
 */
export class ProfileHeadCache {
  private readonly entries = new Map<string, { html: string; expiresAt: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = PROFILE_HEAD_TTL_MS,
    private readonly maxEntries = PROFILE_HEAD_MAX_ENTRIES,
  ) {}

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.html;
  }

  set(key: string, html: string): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { html, expiresAt: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}
