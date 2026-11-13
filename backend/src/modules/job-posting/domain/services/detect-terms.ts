import { DictionaryEntry } from '../term-dictionary';

/**
 * Tokeniza como D11: NFKD sin diacríticos, minúsculas, todo lo que no es `[a-z0-9#+.]` pasa a
 * espacio, y a cada token se le quita el punto final (fin de oración) —`kubernetes.` y `.net.`
 * quedan `kubernetes` y `.net`—. Un `.` suelto no es un token.
 */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9#+.]+/g, ' ')
    .split(' ')
    .map((token) => token.replace(/\.+$/, ''))
    .filter((token) => token !== '');
}

/**
 * Un alias de uno o dos caracteres alfanuméricos (`go`, `r`, `c`, `ml`) es ambiguo: matchea
 * palabras comunes de la prosa («go to market»). No se usa solo; `c#` y `c++` no son ambiguos
 * porque llevan símbolos.
 */
function isAmbiguousSingleToken(tokens: readonly string[]): boolean {
  return tokens.length === 1 && /^[a-z0-9]{1,2}$/.test(tokens[0]);
}

/** Formas buscables de un nombre (un alias, un término o un tag): sus tokens y la forma pegada. */
function formsOf(name: string): string[][] {
  const tokens = tokenize(name);
  if (tokens.length === 0) return [];
  const forms: string[][] = [tokens];
  if (tokens.length > 1) forms.push([tokens.join('')]);
  return forms.filter((form) => !isAmbiguousSingleToken(form));
}

/** El texto como una cadena de tokens entre espacios, para buscar secuencias completas. */
function asHaystack(text: string): string {
  return ` ${tokenize(text).join(' ')} `;
}

function containsAny(haystack: string, forms: readonly string[][]): boolean {
  return forms.some((form) => haystack.includes(` ${form.join(' ')} `));
}

/**
 * Detecta los términos de una vacante (D11, puro). Cada alias o tag se busca como secuencia de
 * tokens completa: `java` no matchea en `javascript` y `spring boot` son dos tokens. Cada tag del
 * vocabulario se busca también por el slug con guiones como espacios, pegado y tal cual.
 * Devuelve términos únicos: primero los del diccionario por su `term`, después los tags del
 * vocabulario que el diccionario no cubre, por su tag.
 */
export function detectTerms(
  text: string,
  dictionary: ReadonlyArray<DictionaryEntry>,
  vocabulary: readonly string[],
): string[] {
  const haystack = asHaystack(text);
  const found = new Set<string>();

  const fromDictionary: string[] = [];
  for (const entry of dictionary) {
    const forms = [entry.term, ...entry.aliases].flatMap(formsOf);
    if (containsAny(haystack, forms)) fromDictionary.push(entry.term);
  }
  for (const term of fromDictionary.sort()) found.add(term);

  const fromVocabulary: string[] = [];
  for (const tag of vocabulary) {
    if (found.has(tag)) continue;
    if (containsAny(haystack, formsOf(tag))) fromVocabulary.push(tag);
  }
  for (const tag of [...new Set(fromVocabulary)].sort()) found.add(tag);

  return [...found];
}
