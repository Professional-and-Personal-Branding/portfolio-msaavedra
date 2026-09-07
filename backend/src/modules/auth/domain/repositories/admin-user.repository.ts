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
}
