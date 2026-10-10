import { ValidationError } from '../../../../../shared/domain/errors';
import { Language, NewLanguageProps } from '../../../domain/entities/language.entity';
import { Profile, ProfileContent } from '../../../domain/entities/profile.entity';
import { LanguageNotFoundError } from '../../../domain/errors/language-not-found.error';
import { ProfileNotFoundError } from '../../../domain/errors/profile-not-found.error';
import {
  LanguageRepository,
  ProfileRepository,
} from '../../../domain/repositories/profile.repository';
import { Availability } from '../../../domain/value-objects/availability.vo';
import {
  CreateLanguageUseCase,
  DeleteLanguageUseCase,
  GetLanguageAdminUseCase,
  ListAllLanguagesUseCase,
  UpdateLanguageUseCase,
} from './language-admin.use-cases';
import {
  GetProfileAdminUseCase,
  PreviewProfileUseCase,
  ReplaceProfileUseCase,
} from './profile-admin.use-cases';

const CONTENT: ProfileContent = {
  fullName: 'Manuel Saavedra',
  headline: { es: 'Ingeniero Senior', en: 'Senior Engineer' },
  location: 'Santa Cruz',
  timezone: 'GMT-4',
  email: 'm@example.com',
  phone: null,
  summary: { es: 'Resumen', en: 'Summary' },
  yearsOfExperience: 14,
  availability: Availability.create({
    modality: { es: 'Remoto', en: 'Remote' },
    contractType: null,
    startDate: { es: 'Inmediata', en: 'Immediate' },
  }),
};

const SPANISH = Language.create({
  id: 'l1',
  name: 'Español',
  nameI18n: { es: 'Español', en: 'Spanish' },
  level: 'Nativo',
  detail: null,
});

const PROFILE = Profile.create({ ...CONTENT, id: 'p1', languages: [SPANISH] });

function profileRepo(profile: Profile | null = PROFILE) {
  let current = profile;
  const repo: ProfileRepository = {
    findOne: jest.fn(() => Promise.resolve(current)),
    save: jest.fn((p: Profile) => {
      current = p;
      return Promise.resolve(p);
    }),
  };
  return { repo, current: () => current };
}

describe('Perfil base (spec admin-content-management, D1)', () => {
  it('GET devuelve los campos bilingües crudos, no resueltos', async () => {
    const result = await new GetProfileAdminUseCase(profileRepo().repo).execute();
    if (!result.ok) throw new Error('debía encontrar el perfil');
    expect(result.value.headline).toEqual({ es: 'Ingeniero Senior', en: 'Senior Engineer' });
    expect(result.value.availability.contractType).toBeNull();
  });

  it('GET sin perfil cargado → ProfileNotFoundError', async () => {
    const result = await new GetProfileAdminUseCase(profileRepo(null).repo).execute();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ProfileNotFoundError);
  });

  it('PUT reemplaza el contenido y conserva id e idiomas', async () => {
    const { repo, current } = profileRepo();
    const result = await new ReplaceProfileUseCase(repo).execute({
      ...CONTENT,
      headline: { es: 'Tech Lead', en: 'Tech Lead' },
    });
    if (!result.ok) throw new Error('debía guardar');
    expect(result.value.headline).toEqual({ es: 'Tech Lead', en: 'Tech Lead' });
    expect(current()?.id).toBe('p1');
    expect(current()?.languages).toHaveLength(1);
  });

  it('PUT con un obligatorio vacío no escribe y conserva el anterior', async () => {
    const { repo, current } = profileRepo();
    const result = await new ReplaceProfileUseCase(repo).execute({ ...CONTENT, email: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
    expect(current()?.email).toBe('m@example.com');
  });

  it('PUT sin perfil cargado → ProfileNotFoundError', async () => {
    const result = await new ReplaceProfileUseCase(profileRepo(null).repo).execute(CONTENT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ProfileNotFoundError);
  });

  it('preview: resuelve el borrador al idioma pedido y no guarda nada', async () => {
    const { repo } = profileRepo();
    const result = await new PreviewProfileUseCase(repo).execute({
      content: { ...CONTENT, headline: { es: 'Borrador', en: 'Draft' } },
      locale: 'en',
    });
    if (!result.ok) throw new Error('debía previsualizar');
    expect(result.value.headline).toBe('Draft');
    expect(result.value.availability.startDate).toBe('Immediate');
    expect(result.value.languages.map((l) => l.name)).toEqual(['Spanish']);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('preview inválido → ValidationError', async () => {
    const result = await new PreviewProfileUseCase(profileRepo().repo).execute({
      content: { ...CONTENT, fullName: '' },
      locale: 'es',
    });
    expect(result.ok).toBe(false);
  });
});

function languageRepo(items: Language[] = [SPANISH]): LanguageRepository & { store: Language[] } {
  const store = [...items];
  return {
    store,
    findAll: jest.fn(() => Promise.resolve([...store])),
    findById: jest.fn((id: string) => Promise.resolve(store.find((l) => l.id === id) ?? null)),
    create: jest.fn((_profileId: string, props: NewLanguageProps) => {
      const created = Language.create({ ...props, id: `new-${store.length + 1}` });
      store.push(created);
      return Promise.resolve(created);
    }),
    update: jest.fn((l: Language) => {
      const i = store.findIndex((x) => x.id === l.id);
      if (i < 0) return Promise.resolve(null);
      store[i] = l;
      return Promise.resolve(l);
    }),
    delete: jest.fn((id: string) => {
      const i = store.findIndex((x) => x.id === id);
      if (i < 0) return Promise.resolve(false);
      store.splice(i, 1);
      return Promise.resolve(true);
    }),
  };
}

describe('Idiomas (spec admin-content-management, D2)', () => {
  const ENGLISH: NewLanguageProps = {
    name: 'Inglés',
    nameI18n: null,
    level: { es: 'Intermedio alto', en: 'Upper intermediate' },
    detail: null,
  };

  it('lista y busca por id con datos crudos; 404 si no existe', async () => {
    const repo = languageRepo();
    const list = await new ListAllLanguagesUseCase(repo).execute();
    expect(list.value[0].nameI18n).toEqual({ es: 'Español', en: 'Spanish' });
    const missing = await new GetLanguageAdminUseCase(repo).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(LanguageNotFoundError);
  });

  it('crear lo cuelga del perfil base', async () => {
    const repo = languageRepo();
    const result = await new CreateLanguageUseCase(repo, profileRepo().repo).execute(ENGLISH);
    expect(result.ok).toBe(true);
    expect(repo.create).toHaveBeenCalledWith('p1', ENGLISH);
  });

  it('crear sin perfil cargado → ProfileNotFoundError; inválido → sin persistir', async () => {
    const repo = languageRepo([]);
    const orphan = await new CreateLanguageUseCase(repo, profileRepo(null).repo).execute(ENGLISH);
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.error).toBeInstanceOf(ProfileNotFoundError);
    const invalid = await new CreateLanguageUseCase(repo, profileRepo().repo).execute({
      ...ENGLISH,
      level: { es: ' ' },
    });
    expect(invalid.ok).toBe(false);
    expect(repo.store).toHaveLength(0);
  });

  it('editar es parcial y valida el resultado; borrar da 404 la segunda vez', async () => {
    const repo = languageRepo();
    const updated = await new UpdateLanguageUseCase(repo).execute({
      id: 'l1',
      changes: { level: { es: 'Bilingüe' } },
    });
    if (!updated.ok) throw new Error('debía editar');
    // el nivel nuevo reemplaza el objeto completo: no queda el `en` anterior
    expect(updated.value).toMatchObject({ name: 'Español', level: { es: 'Bilingüe' } });
    expect(updated.value.level).not.toHaveProperty('en');
    const invalid = await new UpdateLanguageUseCase(repo).execute({
      id: 'l1',
      changes: { name: ' ' },
    });
    expect(invalid.ok).toBe(false);

    expect((await new DeleteLanguageUseCase(repo).execute({ id: 'l1' })).ok).toBe(true);
    expect((await new DeleteLanguageUseCase(repo).execute({ id: 'l1' })).ok).toBe(false);
  });
});
