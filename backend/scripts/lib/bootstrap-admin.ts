/**
 * Núcleo del bootstrap del administrador (change `add-admin-password-change`, D10): el upsert
 * vive aparte del script para poder probarlo. Crear deja `sessionVersion` en 0; actualizar la
 * incrementa para cerrar las sesiones abiertas, igual que el cambio de contraseña del panel.
 */
import type { PrismaClient } from '@prisma/client';

export interface BootstrapAdminInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
}

export async function upsertAdminUser(
  prisma: PrismaClient,
  input: BootstrapAdminInput,
): Promise<{ created: boolean; email: string; name: string; sessionVersion: number }> {
  const { email, passwordHash, name } = input;
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  const admin = await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, name },
    update: { passwordHash, name, sessionVersion: { increment: 1 } },
  });
  return {
    created: !existing,
    email: admin.email,
    name: admin.name,
    sessionVersion: admin.sessionVersion,
  };
}
