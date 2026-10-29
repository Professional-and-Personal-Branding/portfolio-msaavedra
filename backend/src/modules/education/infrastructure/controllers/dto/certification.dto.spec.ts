import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateCertificationDto,
  toCertificationChanges,
  toNewCertificationProps,
  UpdateCertificationDto,
} from './certification.dto';

const BASE = { name: { es: 'Nube', en: 'Cloud' }, issuer: 'Escuela Demo' };

function invalidProps<T extends object>(dto: new () => T, body: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(dto, body)).map((e) => e.property);
}

describe('CreateCertificationDto · credencial (D3)', () => {
  it('acepta la credencial completa y la ausencia de los tres campos', () => {
    expect(
      invalidProps(CreateCertificationDto, {
        ...BASE,
        verificationUrl: 'https://example.org/credenciales/1',
        credentialId: 'EJ-2023-0042',
        expiresAt: '2029-06',
      }),
    ).toEqual([]);
    expect(invalidProps(CreateCertificationDto, BASE)).toEqual([]);
    expect(
      invalidProps(CreateCertificationDto, {
        ...BASE,
        verificationUrl: null,
        credentialId: null,
        expiresAt: null,
      }),
    ).toEqual([]);
  });

  it.each([
    ['verificationUrl', 'http://example.org/c/1'],
    ['verificationUrl', 'javascript:alert(1)'],
    ['verificationUrl', 'data:text/html,x'],
    ['verificationUrl', '/c/1'],
    ['verificationUrl', 'example.org/c/1'],
    ['verificationUrl', `https://example.org/${'a'.repeat(2049)}`],
    ['credentialId', 'x'.repeat(101)],
    ['credentialId', 42],
    ['expiresAt', '2029-13'],
    ['expiresAt', '06/2029'],
    ['expiresAt', '29'],
  ])('rechaza %s = %p', (field, value) => {
    expect(invalidProps(CreateCertificationDto, { ...BASE, [field]: value })).toEqual([field]);
  });
});

describe('mapeo del DTO de certificación', () => {
  it('toNewCertificationProps recorta y convierte vacío o ausente en null', () => {
    const dto = plainToInstance(CreateCertificationDto, {
      ...BASE,
      verificationUrl: '  https://example.org/c/1  ',
      credentialId: '   ',
    });
    expect(toNewCertificationProps(dto)).toMatchObject({
      verificationUrl: 'https://example.org/c/1',
      credentialId: null,
      expiresAt: null,
    });
  });

  it('toCertificationChanges distingue null (quitar) de ausente (no tocar)', () => {
    const only = plainToInstance(UpdateCertificationDto, { verificationUrl: null });
    const changes = toCertificationChanges(only);
    expect(changes).toEqual({ verificationUrl: null });
    expect(Object.keys(changes)).not.toContain('credentialId');
    expect(Object.keys(changes)).not.toContain('expiresAt');

    const edited = plainToInstance(UpdateCertificationDto, {
      credentialId: ' ID-9 ',
      expiresAt: '2030',
    });
    expect(toCertificationChanges(edited)).toEqual({ credentialId: 'ID-9', expiresAt: '2030' });
  });
});
