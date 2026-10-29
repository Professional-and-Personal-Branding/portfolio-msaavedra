import {
  encodeShareCode,
  isShareCode,
  normalizeShareCode,
  SHARE_CODE_ALPHABET,
  SHARE_CODE_LENGTH,
} from './share-code';

describe('share-code', () => {
  it('el alfabeto tiene 32 símbolos únicos y sin i, l, o, u', () => {
    expect(SHARE_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(SHARE_CODE_ALPHABET).size).toBe(32);
    for (const forbidden of ['i', 'l', 'o', 'u'])
      expect(SHARE_CODE_ALPHABET).not.toContain(forbidden);
  });

  describe('encodeShareCode', () => {
    it('usa los 5 bits bajos de cada byte', () => {
      // 0 → primer símbolo; 31 → último; 32 → vuelve a 0; 255 → 31.
      expect(encodeShareCode([0, 31, 32, 255])).toBe('0z0z');
    });

    it('da 10 símbolos para 10 bytes y todos pertenecen al alfabeto', () => {
      const code = encodeShareCode(Uint8Array.from({ length: 10 }, (_, i) => i * 25));
      expect(code).toHaveLength(SHARE_CODE_LENGTH);
      expect(isShareCode(code)).toBe(true);
    });
  });

  describe('normalizeShareCode', () => {
    it('acepta un código válido, con mayúsculas y espacios alrededor', () => {
      expect(normalizeShareCode('k7m2q9xw4t')).toBe('k7m2q9xw4t');
      expect(normalizeShareCode('  K7M2Q9XW4T ')).toBe('k7m2q9xw4t');
    });

    it.each([
      ['9 caracteres', 'k7m2q9xw4'],
      ['11 caracteres', 'k7m2q9xw4tt'],
      ['con i', 'k7m2q9xw4i'],
      ['con l', 'k7m2q9xw4l'],
      ['con o', 'k7m2q9xw4o'],
      ['con u', 'k7m2q9xw4u'],
      ['vacío', ''],
      ['solo espacios', '   '],
      ['espacio interno', 'k7m2q 9xw4'],
      ['no-existe', 'no-existe'],
    ])('rechaza %s', (_name, raw) => {
      expect(normalizeShareCode(raw)).toBeNull();
    });

    it('rechaza lo que no es texto', () => {
      expect(normalizeShareCode(undefined)).toBeNull();
      expect(normalizeShareCode(['k7m2q9xw4t'])).toBeNull();
      expect(normalizeShareCode(10)).toBeNull();
    });
  });
});
