import {
  ShareLink,
  ShareLinkProps,
  validateNewShareLink,
  validateShareLinkLabel,
} from './share-link.entity';

const base: ShareLinkProps = {
  id: 'sl1',
  code: 'k7m2q9xw4t',
  curatedProfileId: 'p1',
  label: 'Acme',
  portal: 'linkedin',
  kind: 'MANUAL',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  revokedAt: null,
};

describe('ShareLink', () => {
  it('está activo sin revocar y pertenece solo a su perfil', () => {
    const link = new ShareLink(base);
    expect(link.isActive()).toBe(true);
    expect(link.belongsTo('p1')).toBe(true);
    expect(link.belongsTo('p2')).toBe(false);
  });

  describe('rename', () => {
    it('recorta y conserva código, portal, tipo y perfil', () => {
      const result = new ShareLink(base).rename('  Globex  ');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.label).toBe('Globex');
      expect(result.value.code).toBe(base.code);
      expect(result.value.portal).toBe(base.portal);
      expect(result.value.kind).toBe(base.kind);
      expect(result.value.curatedProfileId).toBe(base.curatedProfileId);
    });

    it('rechaza la etiqueta vacía y la de 81 caracteres', () => {
      expect(new ShareLink(base).rename('   ').ok).toBe(false);
      expect(new ShareLink(base).rename('x'.repeat(81)).ok).toBe(false);
      expect(new ShareLink(base).rename('x'.repeat(80)).ok).toBe(true);
    });
  });

  describe('revoke', () => {
    it('fija la fecha y desactiva el enlace', () => {
      const now = new Date('2026-10-05T10:00:00Z');
      const revoked = new ShareLink(base).revoke(now);
      expect(revoked.isActive()).toBe(false);
      expect(revoked.revokedAt).toEqual(now);
    });

    it('revocar dos veces conserva la primera fecha', () => {
      const first = new Date('2026-10-05T10:00:00Z');
      const twice = new ShareLink(base).revoke(first).revoke(new Date('2026-10-09T10:00:00Z'));
      expect(twice.revokedAt).toEqual(first);
    });
  });
});

describe('validateShareLinkLabel', () => {
  it('acepta de 1 a 80 caracteres y recorta', () => {
    expect(validateShareLinkLabel(' a ')).toEqual({ ok: true, value: 'a' });
    expect(validateShareLinkLabel('x'.repeat(80)).ok).toBe(true);
  });
  it('rechaza vacío y más de 80', () => {
    expect(validateShareLinkLabel('').ok).toBe(false);
    expect(validateShareLinkLabel('x'.repeat(81)).ok).toBe(false);
  });
});

describe('validateNewShareLink', () => {
  it('normaliza el portal', () => {
    expect(validateNewShareLink({ label: 'Acme', portal: 'LinkedIn' })).toEqual({
      ok: true,
      value: { label: 'Acme', portal: 'linkedin' },
    });
  });
  it('portal ausente o vacío → null', () => {
    expect(validateNewShareLink({ label: 'Acme' })).toEqual({
      ok: true,
      value: { label: 'Acme', portal: null },
    });
    expect(validateNewShareLink({ label: 'Acme', portal: '  ' })).toEqual({
      ok: true,
      value: { label: 'Acme', portal: null },
    });
  });
  it('un portal inválido es error (no se descarta como en src)', () => {
    const result = validateNewShareLink({ label: 'Acme', portal: 'mi portal!' });
    expect(result.ok).toBe(false);
  });
  it('etiqueta vacía es error', () => {
    expect(validateNewShareLink({ label: '' }).ok).toBe(false);
  });
});
