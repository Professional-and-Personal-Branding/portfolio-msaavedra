import { NewLanguageProps } from '../entities/language.entity';
import { ProfileContent } from '../entities/profile.entity';
import { Availability } from '../value-objects/availability.vo';
import { validateLanguage, validateProfileContent } from './validate-profile';

const CONTENT: ProfileContent = {
  fullName: 'Manuel Saavedra',
  headline: { es: 'Ingeniero Senior', en: 'Senior Engineer' },
  location: 'Santa Cruz',
  timezone: 'GMT-4',
  email: 'm@example.com',
  phone: null,
  summary: { es: 'Resumen' },
  yearsOfExperience: 14,
  availability: Availability.create({ modality: null, contractType: null, startDate: null }),
};

describe('validateProfileContent', () => {
  it('acepta un perfil completo, aun sin disponibilidad ni inglés', () => {
    expect(validateProfileContent(CONTENT).ok).toBe(true);
  });

  it.each([
    [{ fullName: ' ' }, 'fullName'],
    [{ headline: { es: '', en: 'Only english' } }, 'headline'],
    [{ summary: {} }, 'summary'],
    [{ email: '' }, 'email'],
    [{ email: 'sin-arroba.com' }, 'email'],
    [{ location: '' }, 'location'],
    [{ yearsOfExperience: -1 }, 'yearsOfExperience'],
    [{ yearsOfExperience: 2.5 }, 'yearsOfExperience'],
  ])('rechaza %o', (changes, field) => {
    const result = validateProfileContent({ ...CONTENT, ...changes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual([field]);
  });

  it('un texto plano legacy cuenta como contenido', () => {
    expect(validateProfileContent({ ...CONTENT, headline: 'Ingeniero' }).ok).toBe(true);
  });
});

describe('validateLanguage', () => {
  const LANGUAGE: NewLanguageProps = { name: 'Inglés', nameI18n: null, level: 'B2', detail: null };

  it('acepta nombre y nivel; rechaza cualquiera vacío', () => {
    expect(validateLanguage(LANGUAGE).ok).toBe(true);
    expect(validateLanguage({ ...LANGUAGE, name: '' }).ok).toBe(false);
    expect(validateLanguage({ ...LANGUAGE, level: ' ' }).ok).toBe(false);
  });
});
