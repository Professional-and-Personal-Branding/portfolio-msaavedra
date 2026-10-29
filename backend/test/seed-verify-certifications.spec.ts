import { certificationCredentialDiffs } from '../scripts/lib/certification-diff';
import type { SeedCertification } from '../scripts/lib/seed-source';

/**
 * Comparación de la credencial entre la fuente del seed y la base
 * (`add-certification-verification`, D9; la usa `seed:verify` y `seed:example:verify`).
 */
const SOURCE: SeedCertification[] = [
  {
    name: { es: 'Arquitecto de Soluciones', en: 'Solutions Architect' },
    issuer: 'X',
    year: '2023',
    verificationUrl: 'https://example.org/c/1',
    credentialId: 'EJ-1',
    expiresAt: '2029-06',
  },
  { name: { es: 'Sin credencial', en: 'No credential' }, issuer: 'X', year: null },
];
const ROWS = [
  { verificationUrl: 'https://example.org/c/1', credentialId: 'EJ-1', expiresAt: '2029-06' },
  { verificationUrl: null, credentialId: null, expiresAt: null },
];

describe('certificationCredentialDiffs', () => {
  it('sin diferencias cuando coincide (ausente en la fuente = null en la base)', () => {
    expect(certificationCredentialDiffs(SOURCE, ROWS)).toEqual([]);
  });

  it('nombra la certificación y el campo que difiere', () => {
    const rows = [{ ...ROWS[0], credentialId: 'CAMBIADO' }, ROWS[1]];
    const diffs = certificationCredentialDiffs(SOURCE, rows);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toContain('certifications[0]');
    expect(diffs[0]).toContain('Arquitecto de Soluciones');
    expect(diffs[0]).toContain('credentialId');
    expect(diffs[0]).toContain('"CAMBIADO"');
  });

  it('detecta un valor de más en la base y uno de menos', () => {
    const rows = [
      { ...ROWS[0], verificationUrl: null },
      { ...ROWS[1], expiresAt: '2030' },
    ];
    const diffs = certificationCredentialDiffs(SOURCE, rows);
    expect(diffs).toHaveLength(2);
    expect(diffs[0]).toContain('verificationUrl');
    expect(diffs[1]).toContain('expiresAt');
  });
});
