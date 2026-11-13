import { NewFeaturedRepositoryProps } from '../entities/featured-repository.entity';
import { validateFeaturedRepository } from './validate-featured-repository';

const VALID: NewFeaturedRepositoryProps = {
  name: 'reservas-api',
  url: 'https://github.com/octo-org/reservas-api',
  language: 'Java',
  description: { es: 'API de reservas' },
  technologies: [],
  tags: [],
  order: 0,
  visible: true,
};

describe('validateFeaturedRepository', () => {
  it('acepta un repositorio completo y uno sin lenguaje', () => {
    expect(validateFeaturedRepository(VALID).ok).toBe(true);
    expect(validateFeaturedRepository({ ...VALID, language: null }).ok).toBe(true);
  });

  it('el nombre cuenta recortado: 100 pasa, 101 no', () => {
    expect(validateFeaturedRepository({ ...VALID, name: ` ${'n'.repeat(100)} ` }).ok).toBe(true);
    expect(validateFeaturedRepository({ ...VALID, name: 'n'.repeat(101) }).ok).toBe(false);
  });

  it('language admite hasta 40 caracteres', () => {
    expect(validateFeaturedRepository({ ...VALID, language: 'l'.repeat(40) }).ok).toBe(true);
    expect(validateFeaturedRepository({ ...VALID, language: 'l'.repeat(41) }).ok).toBe(false);
  });

  it.each([
    [{ name: '   ' }, 'name'],
    [{ name: 'n'.repeat(101) }, 'name'],
    [{ language: 'l'.repeat(41) }, 'language'],
    [{ url: 'https://gitlab.com/a/b' }, 'url'],
    [{ url: 'https://github.com/a/b/' }, 'url'],
    [{ url: 'https://github.com/a/b.git' }, 'url'],
  ])('rechaza %o', (changes, field) => {
    const result = validateFeaturedRepository({ ...VALID, ...changes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual([field]);
  });
});
