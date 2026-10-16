/**
 * Familias disponibles en Google Fonts; el resto se resuelve con el stack del sistema.
 * `Inter` no está: se sirve desde el propio origen (`@font-face` de `theme.css`, D6 de
 * `improve-mobile-performance`).
 */
const GOOGLE_FONTS = new Set([
  'Poppins',
  'Playfair Display',
  'JetBrains Mono',
  'Lora',
  'Merriweather',
]);
const loaded = new Set<string>();

/** Inyecta una vez el `<link>` de Google Fonts para la familia (con `display=swap`). */
export function ensureFontLoaded(family: string): void {
  const name = family.trim();
  if (!GOOGLE_FONTS.has(name) || loaded.has(name) || typeof document === 'undefined') return;
  loaded.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
  link.dataset.font = name;
  document.head.appendChild(link);
}
