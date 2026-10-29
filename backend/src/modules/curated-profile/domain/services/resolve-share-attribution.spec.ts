import { ShareLink, ShareLinkProps } from '../entities/share-link.entity';
import { resolveShareAttribution } from './resolve-share-attribution';

const props = (over: Partial<ShareLinkProps> = {}): ShareLinkProps => ({
  id: 'sl1',
  code: 'k7m2q9xw4t',
  curatedProfileId: 'p1',
  label: 'Acme',
  portal: null,
  kind: 'MANUAL',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  revokedAt: null,
  ...over,
});

describe('resolveShareAttribution', () => {
  it('sin enlace (ausente, malformado o inexistente): sin atribución', () => {
    expect(resolveShareAttribution({ curatedProfileId: 'p1', link: null, src: undefined })).toEqual(
      { shareLinkId: null, source: null },
    );
  });

  it('enlace de otro perfil: sin atribución', () => {
    const link = new ShareLink(props({ curatedProfileId: 'p2', portal: 'linkedin' }));
    expect(resolveShareAttribution({ curatedProfileId: 'p1', link, src: undefined })).toEqual({
      shareLinkId: null,
      source: null,
    });
  });

  it('enlace revocado: sin atribución, el portal del enlace no cuenta', () => {
    const link = new ShareLink(props({ portal: 'linkedin' })).revoke(new Date());
    expect(resolveShareAttribution({ curatedProfileId: 'p1', link, src: undefined })).toEqual({
      shareLinkId: null,
      source: null,
    });
  });

  it('enlace activo del mismo perfil: atribuye', () => {
    const link = new ShareLink(props());
    expect(resolveShareAttribution({ curatedProfileId: 'p1', link, src: undefined })).toEqual({
      shareLinkId: 'sl1',
      source: null,
    });
  });

  describe('source', () => {
    it('el portal del enlace atribuido gana sobre src', () => {
      const link = new ShareLink(props({ portal: 'linkedin' }));
      expect(resolveShareAttribution({ curatedProfileId: 'p1', link, src: 'indeed' }).source).toBe(
        'linkedin',
      );
    });

    it('enlace atribuido sin portal: usa src normalizado', () => {
      const link = new ShareLink(props());
      expect(resolveShareAttribution({ curatedProfileId: 'p1', link, src: 'Indeed' }).source).toBe(
        'indeed',
      );
    });

    it('enlace no atribuible: src normalizado igual', () => {
      const link = new ShareLink(props({ curatedProfileId: 'p2', portal: 'linkedin' }));
      expect(resolveShareAttribution({ curatedProfileId: 'p1', link, src: 'indeed' })).toEqual({
        shareLinkId: null,
        source: 'indeed',
      });
    });

    it('src inválido (40 caracteres, espacios internos) → null', () => {
      expect(
        resolveShareAttribution({ curatedProfileId: 'p1', link: null, src: 'a'.repeat(40) }).source,
      ).toBeNull();
      expect(
        resolveShareAttribution({ curatedProfileId: 'p1', link: null, src: 'mi portal' }).source,
      ).toBeNull();
    });
  });
});
