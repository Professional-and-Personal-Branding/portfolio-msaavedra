import { CuratedVisibility } from '../entities/curated-profile.entity';
import { Resolvability, resolvability } from './resolvability';

const ARCHIVED = new Date('2026-10-01T00:00:00Z');

/** La tabla de verdad de la spec: seis filas × dos columnas = doce casos. */
const TABLE: Array<[CuratedVisibility, Date | null, Resolvability, Resolvability]> = [
  //  visibility   archivedAt  sin token       con token válido
  ['PUBLIC', null, 'ok', 'ok'],
  ['PUBLIC', ARCHIVED, 'not-found', 'not-found'],
  ['PROTECTED', null, 'unauthorized', 'ok'],
  ['PROTECTED', ARCHIVED, 'not-found', 'not-found'],
  ['PRIVATE', null, 'not-found', 'not-found'],
  ['PRIVATE', ARCHIVED, 'not-found', 'not-found'],
];

describe('resolvability (tabla de verdad)', () => {
  describe.each(TABLE)('%s, archivado=%s', (visibility, archivedAt, withoutToken, withToken) => {
    it(`sin token → ${withoutToken}`, () => {
      expect(resolvability(visibility, archivedAt, false)).toBe(withoutToken);
    });
    it(`con token válido → ${withToken}`, () => {
      expect(resolvability(visibility, archivedAt, true)).toBe(withToken);
    });
  });

  it('un archivado nunca da unauthorized, ni siquiera siendo PROTECTED', () => {
    for (const validToken of [false, true]) {
      expect(resolvability('PROTECTED', ARCHIVED, validToken)).not.toBe('unauthorized');
    }
  });
});
