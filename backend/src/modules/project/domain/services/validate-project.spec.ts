import { NewProjectProps } from '../entities/project.entity';
import { isHttpUrl } from '../../../../shared/domain/http-url';
import { validateProject } from './validate-project';

const VALID: NewProjectProps = {
  name: 'Portafolio',
  role: { es: 'Autor' },
  period: '2026',
  summary: { es: 'Resumen' },
  technologies: [],
  tags: [],
  url: 'https://github.com/manu/portafolio',
  order: 0,
  visible: true,
};

describe('validateProject', () => {
  it('acepta un proyecto completo y uno sin url', () => {
    expect(validateProject(VALID).ok).toBe(true);
    expect(validateProject({ ...VALID, url: null }).ok).toBe(true);
  });

  it.each([
    [{ name: '  ' }, 'name'],
    [{ period: '' }, 'period'],
    [{ url: 'github.com/manu' }, 'url'],
    [{ url: 'javascript:alert(1)' }, 'url'],
  ])('rechaza %o', (changes, field) => {
    const result = validateProject({ ...VALID, ...changes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual([field]);
  });

  it('isHttpUrl solo admite http y https', () => {
    expect(isHttpUrl('http://a.dev')).toBe(true);
    expect(isHttpUrl('ftp://a.dev')).toBe(false);
    expect(isHttpUrl('no es url')).toBe(false);
  });
});
