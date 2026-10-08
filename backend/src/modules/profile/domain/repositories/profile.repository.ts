import { Language, NewLanguageProps } from '../entities/language.entity';
import { Profile } from '../entities/profile.entity';

/** Token de inyección del puerto (un Symbol no depende de NestJS). */
export const PROFILE_REPOSITORY = Symbol('ProfileRepository');
export const LANGUAGE_REPOSITORY = Symbol('LanguageRepository');

/** Puerto de persistencia del perfil base. Lo implementa infrastructure/persistence. */
export interface ProfileRepository {
  /** Devuelve el único perfil base, o null si no hay ninguno cargado. */
  findOne(): Promise<Profile | null>;
  /**
   * Persiste el contenido del perfil (no los idiomas, que tienen su propio
   * puerto); null si ya no existe.
   */
  save(profile: Profile): Promise<Profile | null>;
}

/** Idiomas del perfil base (backoffice). Cuelgan del perfil, pero se editan aparte (D2). */
export interface LanguageRepository {
  findAll(): Promise<Language[]>;
  findById(id: string): Promise<Language | null>;
  create(profileId: string, props: NewLanguageProps): Promise<Language>;
  /** Persiste el estado completo; null si ya no existe. */
  update(language: Language): Promise<Language | null>;
  /** true si existía y fue borrado. */
  delete(id: string): Promise<boolean>;
}
