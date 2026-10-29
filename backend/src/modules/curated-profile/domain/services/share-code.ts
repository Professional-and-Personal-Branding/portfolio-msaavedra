/**
 * Código de un enlace de seguimiento (decisión D2 de `add-share-links`): 10 símbolos del
 * alfabeto base32 de Crockford en minúsculas (sin `i`, `l`, `o`, `u` para que no se confundan
 * al dictarlo o copiarlo a mano), unos 50 bits. Funciones puras: la aleatoriedad la pone el
 * adaptador (`ShareCodeGenerator`); el dominio solo codifica y reconoce el formato.
 */
export const SHARE_CODE_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
export const SHARE_CODE_LENGTH = 10;

/**
 * Codifica bytes en símbolos del alfabeto usando los 5 bits bajos de cada uno. Como 32 divide a
 * 256, un byte uniforme da un símbolo uniforme (sin sesgo de módulo).
 */
export function encodeShareCode(bytes: ArrayLike<number>): string {
  let code = '';
  for (let i = 0; i < bytes.length; i += 1) {
    code += SHARE_CODE_ALPHABET[bytes[i] & 0b11111];
  }
  return code;
}

/** true si el valor tiene exactamente el formato de un código (sin normalizar). */
export function isShareCode(value: string): boolean {
  if (value.length !== SHARE_CODE_LENGTH) return false;
  for (const char of value) {
    if (!SHARE_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Lo que llega en `?via=` → código canónico o `null`. Recorta, pasa a minúsculas y exige el
 * formato exacto: un `null` significa «no consultar la base».
 */
export function normalizeShareCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  return isShareCode(code) ? code : null;
}
