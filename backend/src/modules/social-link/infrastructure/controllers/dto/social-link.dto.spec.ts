import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateSocialLinkDto,
  toNewSocialLinkProps,
  toSocialLinkChanges,
  UpdateSocialLinkDto,
} from './social-link.dto';

const VALID = {
  platform: 'github',
  handle: 'manuXD270516',
  url: 'https://github.com/manuXD270516',
  label: { es: 'Código', en: 'Code' },
};

/** Propiedades con error, con las mismas opciones que `adminValidationPipe`. */
function invalid(cls: new () => object, body: object): string[] {
  const dto = plainToInstance(cls, body, { enableImplicitConversion: false });
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);
}

describe('CreateSocialLinkDto / UpdateSocialLinkDto', () => {
  it('stats: objeto o null válidos; array y string → error (400)', () => {
    expect(invalid(CreateSocialLinkDto, { ...VALID, stats: { repos: 67 } })).toEqual([]);
    expect(invalid(CreateSocialLinkDto, { ...VALID, stats: null })).toEqual([]);
    expect(invalid(CreateSocialLinkDto, { ...VALID, stats: [1, 2] })).toEqual(['stats']);
    expect(invalid(CreateSocialLinkDto, { ...VALID, stats: 'x' })).toEqual(['stats']);
    expect(invalid(UpdateSocialLinkDto, { stats: [1] })).toEqual(['stats']);
  });

  it('label obligatorio al crear; platform en minúsculas', () => {
    const { label: _label, ...sinLabel } = VALID;
    expect(invalid(CreateSocialLinkDto, sinLabel)).toEqual(['label']);
    expect(invalid(CreateSocialLinkDto, { ...VALID, platform: 'GitHub' })).toEqual(['platform']);
  });

  it('PATCH: null en campos obligatorios → error; en description/stats → quitar', () => {
    expect(invalid(UpdateSocialLinkDto, {})).toEqual([]);
    expect(invalid(UpdateSocialLinkDto, { label: null })).toEqual(['label']);
    expect(invalid(UpdateSocialLinkDto, { handle: null })).toEqual(['handle']);
    expect(invalid(UpdateSocialLinkDto, { description: null, stats: null })).toEqual([]);

    const dto = plainToInstance(UpdateSocialLinkDto, { description: null, stats: null });
    expect(toSocialLinkChanges(dto)).toEqual({ description: null, stats: null });
  });

  it('defaults al crear', () => {
    const props = toNewSocialLinkProps(plainToInstance(CreateSocialLinkDto, VALID));
    expect(props).toMatchObject({
      description: null,
      stats: null,
      featured: false,
      order: 0,
      visible: true,
    });
  });
});
