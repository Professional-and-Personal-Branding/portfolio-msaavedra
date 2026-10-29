import {
  toCertificationData,
  toCertificationEntity,
  toEducationEntity,
} from './education.prisma-mapper';

describe('education prisma mappers', () => {
  it('mapea educación y certificación; JSON malformado → vacío', () => {
    const edu = toEducationEntity({
      id: 'e1',
      degree: { es: 'PhD', en: 'PhD' },
      institution: 'UAGRM',
      startDate: '2024-02',
      endDate: null,
      inProgress: true,
      order: 0,
      visible: true,
    });
    expect(edu.degree).toEqual({ es: 'PhD', en: 'PhD' });
    expect(edu.inProgress).toBe(true);

    const cert = toCertificationEntity({
      id: 'c1',
      name: [1] as never,
      issuer: 'X',
      year: '2021',
      verificationUrl: null,
      credentialId: null,
      expiresAt: null,
      order: 0,
      visible: true,
    });
    expect(cert.name).toEqual({});
    expect(cert.year).toBe('2021');
    expect(cert.verificationUrl).toBeNull();
    expect(cert.credentialId).toBeNull();
    expect(cert.expiresAt).toBeNull();
  });

  it('la credencial hace ida y vuelta entre la fila y la entidad (con valores y con null)', () => {
    const credential = {
      verificationUrl: 'https://example.org/credenciales/1',
      credentialId: 'EJ-2023-0042',
      expiresAt: '2029-06',
    };
    const record = {
      id: 'c2',
      name: { es: 'Nube', en: 'Cloud' },
      issuer: 'X',
      year: '2023',
      ...credential,
      order: 1,
      visible: true,
    };
    const entity = toCertificationEntity(record);
    expect(entity.verificationUrl).toBe(credential.verificationUrl);
    expect(entity.credentialId).toBe(credential.credentialId);
    expect(entity.expiresAt).toBe(credential.expiresAt);
    expect(toCertificationData(entity.toProps())).toMatchObject(credential);

    const bare = toCertificationEntity({
      ...record,
      verificationUrl: null,
      credentialId: null,
      expiresAt: null,
    });
    expect(toCertificationData(bare.toProps())).toMatchObject({
      verificationUrl: null,
      credentialId: null,
      expiresAt: null,
    });
  });
});
