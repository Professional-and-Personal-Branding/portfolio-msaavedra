import { MAX_DESCRIPTION_LENGTH } from '../entities/job-posting.entity';

/** Tope de la entrada de `htmlToText`: 5 veces la descripción guardada (100 000 caracteres). */
export const MAX_HTML_INPUT_LENGTH = MAX_DESCRIPTION_LENGTH * 5;

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

/** `<etiqueta ...>` completa, sin otra `<` ni `>` en el medio: el cuerpo no puede crecer sin cierre. */
const TAG_LEFTOVER = /<\/?[a-z][^<>]*>|<!--/i;

const BLOCK_CLOSE = new Set([
  'p',
  'div',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'tr',
  'table',
  'section',
  'article',
  'header',
  'footer',
]);

const isLetter = (code: number): boolean =>
  (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const isAlnum = (code: number): boolean => isLetter(code) || (code >= 48 && code <= 57);

/**
 * Índice del cierre `</nombre ...>` desde `from`, o -1. Búsqueda con `indexOf` hacia adelante:
 * lineal aunque el HTML no tenga cierre (nada de regex con `[\s\S]*?`, cuadráticas sobre entrada
 * remota). Devuelve el índice del primer carácter posterior al `>` del cierre.
 */
function findClosing(html: string, name: string, from: number): number {
  let k = html.indexOf('</', from);
  while (k !== -1) {
    if (html.slice(k + 2, k + 2 + name.length).toLowerCase() === name) {
      let j = k + 2 + name.length;
      while (j < html.length && /\s/.test(html[j])) j += 1;
      if (html[j] === '>') return j + 1;
    }
    k = html.indexOf('</', k + 2);
  }
  return -1;
}

/**
 * Un recorrido lineal que quita comentarios, `<script>`/`<style>` con su contenido (sin cierre,
 * se descarta el resto), convierte cortes de bloque y `<li>`, y reemplaza las demás etiquetas por
 * un espacio. Una etiqueta es `<` + letra, `/` o `!` + `[^<>]*` + `>`: un `<` suelto (`a < b`) es
 * texto. Cada carácter se mira una cantidad acotada de veces.
 */
function stripMarkup(html: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out.push(html.slice(i));
      break;
    }
    out.push(html.slice(i, lt));

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end === -1) break; // comentario sin cierre: se descarta el resto
      out.push(' ');
      i = end + 3;
      continue;
    }

    let j = lt + 1;
    const closing = html[j] === '/';
    if (closing) j += 1;
    const first = html.charCodeAt(j);
    if (!isLetter(first) && !(first === 33 && !closing)) {
      out.push('<'); // `<` suelto
      i = lt + 1;
      continue;
    }
    let nameEnd = j;
    while (nameEnd < html.length && isAlnum(html.charCodeAt(nameEnd))) nameEnd += 1;
    const name = html.slice(j, nameEnd).toLowerCase();

    // El fin de la etiqueta: el primer `>`, siempre que no aparezca otra `<` antes.
    let end = nameEnd;
    while (end < html.length && html[end] !== '>' && html[end] !== '<') end += 1;
    if (html[end] !== '>') {
      out.push('<'); // sin cierre: es texto
      i = lt + 1;
      continue;
    }
    i = end + 1;

    if (!closing && (name === 'script' || name === 'style')) {
      const close = findClosing(html, name, i);
      if (close === -1) break; // sin cierre: se descarta el resto
      out.push(' ');
      i = close;
    } else if (!closing && name === 'br') out.push('\n');
    else if (!closing && name === 'li') out.push('\n• ');
    else if (closing && BLOCK_CLOSE.has(name)) out.push('\n');
    else out.push(' ');
  }
  return out.join('');
}

function stripOnce(html: string): string {
  return decodeEntities(stripMarkup(html));
}

/**
 * HTML → texto. La entrada se corta a `MAX_HTML_INPUT_LENGTH` (5 veces el tope de la descripción)
 * antes de tocarla: una respuesta remota de varios MiB no puede ocupar el event loop, y de todos
 * modos el resultado se corta a 20 000 caracteres.
 */
export function htmlToText(html: string): string {
  let text = html.length > MAX_HTML_INPUT_LENGTH ? html.slice(0, MAX_HTML_INPUT_LENGTH) : html;
  for (let pass = 0; pass < 3; pass += 1) {
    text = stripOnce(text);
    if (!TAG_LEFTOVER.test(text)) break;
  }
  // Si tras tres pasadas quedan etiquetas, se quitan sin decodificar más.
  text = text.replace(/<\/?[a-z][^<>]*>/gi, ' ');

  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\n(?=• )/g, '\n')
    .trim();
}
