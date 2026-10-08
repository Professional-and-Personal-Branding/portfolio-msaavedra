import { isPubliclyListed } from './publicly-listed';

describe('isPubliclyListed', () => {
  const vivo = { visibility: 'PUBLIC', listed: true, archivedAt: null };

  it('PUBLIC, enumerado y vivo → se enumera', () => {
    expect(isPubliclyListed(vivo)).toBe(true);
  });

  it.each([
    ['PROTECTED', { ...vivo, visibility: 'PROTECTED' }],
    ['PRIVATE', { ...vivo, visibility: 'PRIVATE' }],
    ['no enumerado', { ...vivo, listed: false }],
    ['archivado', { ...vivo, archivedAt: new Date() }],
  ])('%s → no se enumera', (_caso, state) => {
    expect(isPubliclyListed(state)).toBe(false);
  });
});
