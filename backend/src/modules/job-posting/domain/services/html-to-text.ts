/**
 * HTML → texto plano (D14), puro y sin dependencias. Quita `<script>` y `<style>` con su
 * contenido, convierte los cortes de bloque en saltos de línea y `<li>` en «• », quita el resto de
 * las etiquetas, decodifica las entidades nombradas comunes y las numéricas, y colapsa espacios.
 *
 * La salida nunca lleva etiquetas: si decodificar produce más (el `content` de Greenhouse viene
 * escapado dos veces: `&lt;p&gt;`), se repite el recorrido, hasta tres pasadas.
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
  deg: '°',
  iexcl: '¡',
  iquest: '¿',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  uuml: 'ü',
  Uuml: 'Ü',
  agrave: 'à',
  egrave: 'è',
  ccedil: 'ç',
  ouml: 'ö',
  auml: 'ä',
};

function fromCodePoint(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return '';
  // Los sustitutos y los caracteres de control (salvo \t \n \r) se descartan.
  if (code >= 0xd800 && code <= 0xdfff) return '';
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) return '';
  return String.fromCodePoint(code);
}

/** Una sola pasada: `&amp;lt;` queda `&lt;`, no `<`. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      return fromCodePoint(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return Object.hasOwn(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : whole;
  });
}

const TAG_LEFTOVER = /<\/?[a-z][^>]*>|<!--/i;

function stripOnce(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<(script|style)\b[\s\S]*$/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/(?:p|div|li|h[1-6]|tr|table|section|article|header|footer)\s*>/gi, '\n')
      .replace(/<\/?[a-z!][^>]*>/gi, ' '),
  );
}

export function htmlToText(html: string): string {
  let text = html;
  for (let pass = 0; pass < 3; pass += 1) {
    text = stripOnce(text);
    if (!TAG_LEFTOVER.test(text)) break;
  }
  // Si tras tres pasadas quedan etiquetas, se quitan sin decodificar más.
  text = text.replace(/<\/?[a-z][^>]*>/gi, ' ');

  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{2,}(?=• )/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
