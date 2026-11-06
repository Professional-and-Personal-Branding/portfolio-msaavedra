import { AdminUser } from '../entities/admin-user.entity';

export const ADMIN_USER_REPOSITORY = Symbol('AdminUserRepository');

export interface UpsertAdminUserProps {
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
}

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  /** Crea o actualiza (nombre y hash) por email. */
  upsert(props: UpsertAdminUserProps): Promise<AdminUser>;
  touchLastLogin(id: string, at: Date): Promise<void>;
  /**
   * Cambia el hash e incrementa `sessionVersion` en una sola escritura, solo si la versión
   * sigue siendo `expectedVersion`. Devuelve `null` si no actualizó ninguna fila (otra petición
   * ganó la carrera o el administrador ya no existe).
   */
  changePassword(
    id: string,
    passwordHash: string,
    expectedVersion: number,
  ): Promise<AdminUser | null>;
}
