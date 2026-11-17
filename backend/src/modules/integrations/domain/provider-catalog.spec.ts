import { isKnownProvider, parseEnabledProviders, PROVIDER_CATALOG } from './provider-catalog';

describe('PROVIDER_CATALOG', () => {
  it('incluye fake (solo pruebas) y github (permitido en producción)', () => {
    expect(PROVIDER_CATALOG.fake).toMatchObject({ id: 'fake', allowedInProduction: false });
    expect(PROVIDER_CATALOG.github).toEqual({
      id: 'github',
      secretEnv: 'GITHUB_SYNC_TOKEN',
      allowedInProduction: true,
    });
  });

  it('el secreto de github NO se llama GITHUB_TOKEN (lo inyectan Actions y otras herramientas)', () => {
    expect(PROVIDER_CATALOG.github.secretEnv).not.toBe('GITHUB_TOKEN');
  });

  it('reconoce github y rechaza ids ajenos al catálogo', () => {
    expect(isKnownProvider('github')).toBe(true);
    expect(isKnownProvider('gitlab')).toBe(false);
    expect(isKnownProvider('toString')).toBe(false);
  });
});

describe('parseEnabledProviders con github', () => {
  it('acepta github solo o junto a fake, sin vacíos ni repetidos', () => {
    expect(parseEnabledProviders('github')).toEqual(['github']);
    expect(parseEnabledProviders(' github , fake,github,, ')).toEqual(['github', 'fake']);
    expect(parseEnabledProviders(undefined)).toEqual([]);
  });
});
