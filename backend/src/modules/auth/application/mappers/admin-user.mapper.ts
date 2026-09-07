import { AdminUser } from '../../domain/entities/admin-user.entity';
import { AdminOutput } from '../dto/auth.output';

/** Nunca expone `passwordHash`. */
export function toAdminOutput(admin: AdminUser): AdminOutput {
  return { id: admin.id, email: admin.email, name: admin.name };
}
