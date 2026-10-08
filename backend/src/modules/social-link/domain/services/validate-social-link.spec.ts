import { NewSocialLinkProps } from '../entities/social-link.entity';
import { validateSocialLink } from './validate-social-link';

const VALID: NewSocialLinkProps = {
  platform: 'github',
  handle: 'manuXD270516',
  url: 'https://github.com/manuXD270516',
  label: { es: 'Código y proyectos abiertos', en: 'Code and open projects' },
  description: { es: 'Perfil con +60 repositorios públicos' },
  stats: { repos: 67, achievements: ['Pull Shark', 'Arctic Code Vault Contributor'] },
  featured: true,
  order: 0,
  visible: true,
};

/** Fuerza un valor que el tipo no admite (llega así desde Json malformado). */
const badStats = (value: unknown) => value as Record<string, unknown>;

describe('validateSocialLink', () => {
  it('acepta los enlaces del seed (con y sin stats/description)', () => {
    expect(validateSocialLink(VALID).ok).toBe(true);
    expect(validateSocialLink({ ...VALID, stats: null, description: null }).ok).toBe(true);
    expect(
      validateSocialLink({
        ...VALID,
        platform: 'youtube',
        handle: '@manueljoaquinsaavedrasever8888',
        url: 'https://www.youtube.com/@manueljoaquinsaavedrasever8888',
        stats: null,
      }).ok,
    ).toBe(true);
    expect(validateSocialLink({ ...VALID, platform: 'dev-to' }).ok).toBe(true);
  });

  it.each([
    [{ platform: '' }, 'platform'],
    [{ platform: 'GitHub' }, 'platform'],
    [{ platform: 'git hub' }, 'platform'],
    [{ handle: '  ' }, 'handle'],
    [{ url: 'github.com/manu' }, 'url'],
    [{ url: 'javascript:alert(1)' }, 'url'],
    [{ label: { es: ' ', en: 'Code' } }, 'label'],
    [{ label: '' }, 'label'],
    [{ stats: badStats([1, 2]) }, 'stats'],
    [{ stats: badStats('x') }, 'stats'],
    [{ stats: badStats(42) }, 'stats'],
  ])('rechaza %o', (changes, field) => {
    const result = validateSocialLink({ ...VALID, ...changes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual([field]);
  });
});
