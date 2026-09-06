import { Language } from '../../domain/entities/language.entity';
import { Profile } from '../../domain/entities/profile.entity';
import { ProfileNotFoundError } from '../../domain/errors/profile-not-found.error';
import { ProfileRepository } from '../../domain/repositories/profile.repository';
import { Availability } from '../../domain/value-objects/availability.vo';
import { GetProfileUseCase } from './get-profile.use-case';

function buildProfile(): Profile {
  return Profile.create({
    id: 'p1',
    fullName: 'Manuel Saavedra',
    headline: { es: 'Ingeniero Senior', en: 'Senior Engineer' },
    location: 'Santa Cruz',
    timezone: 'GMT-4',
    email: 'm@example.com',
    phone: null,
    summary: { es: 'Resumen' }, // sin traducción en inglés → fallback
    yearsOfExperience: 10,
    availability: Availability.create({
      modality: { es: 'Remoto', en: 'Remote' },
      contractType: { es: 'Contractor', en: 'Contractor' },
      startDate: { es: 'Inmediata', en: 'Immediate' },
    }),
    languages: [
      Language.create({
        id: 'l1',
        name: 'Español',
        nameI18n: { es: 'Español', en: 'Spanish' },
        level: 'Nativo',
        detail: { es: 'Nativo', en: 'Native' },
      }),
      Language.create({ id: 'l2', name: 'Inglés', nameI18n: null, level: 'B2', detail: null }),
    ],
  });
}

function repoWith(profile: Profile | null): ProfileRepository {
  return { findOne: jest.fn().mockResolvedValue(profile) };
}

describe('GetProfileUseCase', () => {
  it('devuelve el perfil resuelto en español', async () => {
    const useCase = new GetProfileUseCase(repoWith(buildProfile()));
    const result = await useCase.execute({ locale: 'es' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headline).toBe('Ingeniero Senior');
    expect(result.value.availability.startDate).toBe('Inmediata');
    expect(result.value.languages[0].name).toBe('Español');
  });

  it('devuelve el perfil resuelto en inglés', async () => {
    const useCase = new GetProfileUseCase(repoWith(buildProfile()));
    const result = await useCase.execute({ locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headline).toBe('Senior Engineer');
    expect(result.value.availability.startDate).toBe('Immediate');
    expect(result.value.languages[0].name).toBe('Spanish');
    expect(result.value.languages[0].detail).toBe('Native');
  });

  it('aplica fallback por campo cuando falta la traducción', async () => {
    const useCase = new GetProfileUseCase(repoWith(buildProfile()));
    const result = await useCase.execute({ locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary).toBe('Resumen');
    // idioma sin nameI18n usa el nombre canónico; detail nulo → cadena vacía
    expect(result.value.languages[1].name).toBe('Inglés');
    expect(result.value.languages[1].detail).toBe('');
  });

  it('nunca expone objetos localizados en la salida', async () => {
    const useCase = new GetProfileUseCase(repoWith(buildProfile()));
    const result = await useCase.execute({ locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = JSON.stringify(result.value);
    expect(json).not.toMatch(/"es":/);
    expect(json).not.toMatch(/"en":/);
  });

  it('devuelve ProfileNotFoundError si no hay perfil cargado', async () => {
    const useCase = new GetProfileUseCase(repoWith(null));
    const result = await useCase.execute({ locale: 'es' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(ProfileNotFoundError);
    expect(result.error.code).toBe('PERFIL_NOT_FOUND');
  });
});
