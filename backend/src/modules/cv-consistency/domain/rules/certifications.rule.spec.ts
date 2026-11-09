import { cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvSnapshot } from '../cv-snapshot';
import { certificationsRule } from './certifications.rule';

const withCertification = (changes: Record<string, unknown>): CvSnapshot => {
  const s = cleanSnapshot();
  return { ...s, certifications: s.certifications.map((c) => ({ ...c, ...changes })) };
};

describe('certificationsRule (certification.expired)', () => {
  it('vencida: expiresAt 2025-12 con asOf 2026-11', () => {
    expect(
      certificationsRule(withCertification({ expiresAt: '2025-12' }), { asOf: '2026-11' }),
    ).toEqual([
      {
        code: 'certification.expired',
        severity: 'info',
        entityType: 'certification',
        entityId: 'cert-1',
        field: 'expiresAt',
        params: { expiresAt: '2025-12' },
      },
    ]);
  });

  it('AAAA-MM vence al terminar ese mes', () => {
    const snapshot = withCertification({ expiresAt: '2026-11' });
    expect(certificationsRule(snapshot, { asOf: '2026-11' })).toEqual([]);
    expect(certificationsRule(snapshot, { asOf: '2026-12' })).toHaveLength(1);
  });

  it('AAAA vence al terminar ese año', () => {
    const snapshot = withCertification({ expiresAt: '2026' });
    expect(certificationsRule(snapshot, { asOf: '2026-12' })).toEqual([]);
    expect(certificationsRule(snapshot, { asOf: '2027-01' })).toHaveLength(1);
  });

  it('no emite si no vence, si está oculta o si el formato es inválido', () => {
    const asOf = { asOf: '2026-11' };
    expect(certificationsRule(withCertification({ expiresAt: null }), asOf)).toEqual([]);
    expect(
      certificationsRule(withCertification({ expiresAt: '2020-01', visible: false }), asOf),
    ).toEqual([]);
    expect(certificationsRule(withCertification({ expiresAt: '2020-13' }), asOf)).toEqual([]);
  });
});
