import { normalizeSource } from './normalize-source';

describe('normalizeSource', () => {
  it.each([
    ['Indeed', 'indeed'],
    [' linkedin ', 'linkedin'],
    ['get-on-board', 'get-on-board'],
    ['a', 'a'],
    ['0x', '0x'],
    ['a'.repeat(32), 'a'.repeat(32)],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeSource(raw)).toBe(expected);
  });

  it.each([
    ['33 caracteres', 'a'.repeat(33)],
    ['espacio interno', 'mi portal'],
    ['empieza con guion', '-x'],
    ['vacío', ''],
    ['solo espacios', '   '],
    ['con símbolos', 'mi portal!'],
    ['con tilde', 'compútrabajo'],
    ['con guion bajo', 'get_on_board'],
  ])('descarta %s', (_name, raw) => {
    expect(normalizeSource(raw)).toBeNull();
  });

  it('descarta lo que no es texto', () => {
    expect(normalizeSource(undefined)).toBeNull();
    expect(normalizeSource(null)).toBeNull();
    expect(normalizeSource(['a', 'b'])).toBeNull();
  });
});
