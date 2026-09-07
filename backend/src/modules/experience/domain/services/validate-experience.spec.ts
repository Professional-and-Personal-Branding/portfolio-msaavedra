import { NewExperienceProps } from '../entities/experience.entity';
import { validateExperience } from './validate-experience';

const base: NewExperienceProps = {
  company: 'ACME',
  role: { es: 'Dev' },
  startDate: '2024-01',
  endDate: '2024-12',
  current: false,
  location: 'Remoto',
  summary: { es: 'x' },
  highlights: { es: [] },
  technologies: [],
  tags: [],
  sector: [],
  order: 0,
  visible: true,
};

describe('validateExperience', () => {
  it('acepta una experiencia válida y una actual sin endDate', () => {
    expect(validateExperience(base).ok).toBe(true);
    expect(validateExperience({ ...base, current: true, endDate: null }).ok).toBe(true);
  });

  it('rechaza formatos de fecha inválidos', () => {
    for (const startDate of ['2024-13', 'enero 2024', '2024', '2024-1']) {
      const r = validateExperience({ ...base, startDate });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.fields).toContain('startDate');
    }
  });

  it('rechaza current con endDate, startDate > endDate y company vacío', () => {
    expect(validateExperience({ ...base, current: true }).ok).toBe(false);
    expect(validateExperience({ ...base, startDate: '2025-01', endDate: '2024-01' }).ok).toBe(
      false,
    );
    expect(validateExperience({ ...base, company: '  ' }).ok).toBe(false);
  });
});
