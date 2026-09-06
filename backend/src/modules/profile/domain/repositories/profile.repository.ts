import { Profile } from '../entities/profile.entity';

/** Token de inyección del puerto (un Symbol no depende de NestJS). */
export const PROFILE_REPOSITORY = Symbol('ProfileRepository');

/** Puerto de persistencia del perfil base. Lo implementa infrastructure/persistence. */
export interface ProfileRepository {
  /** Devuelve el único perfil base, o null si no hay ninguno cargado. */
  findOne(): Promise<Profile | null>;
}
