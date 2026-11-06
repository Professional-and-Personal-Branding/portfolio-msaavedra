import { Injectable } from '@nestjs/common';
import type { AdminUser as AdminUserRecord } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  AdminUserRepository,
  UpsertAdminUserProps,
} from '../../domain/repositories/admin-user.repository';

export function toAdminUserEntity(record: AdminUserRecord): AdminUser {
  return AdminUser.create({
    id: record.id,
    email: record.email,
    passwordHash: record.passwordHash,
    name: record.name,
    createdAt: record.createdAt,
    lastLoginAt: record.lastLoginAt,
    sessionVersion: record.sessionVersion,
  });
}

@Injectable()
export class PrismaAdminUserRepository implements AdminUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const record = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return record ? toAdminUserEntity(record) : null;
  }

  async findById(id: string): Promise<AdminUser | null> {
    const record = await this.prisma.adminUser.findUnique({ where: { id } });
    return record ? toAdminUserEntity(record) : null;
  }

  async upsert(props: UpsertAdminUserProps): Promise<AdminUser> {
    const email = props.email.trim().toLowerCase();
    const record = await this.prisma.adminUser.upsert({
      where: { email },
      create: { email, passwordHash: props.passwordHash, name: props.name },
      update: { passwordHash: props.passwordHash, name: props.name },
    });
    return toAdminUserEntity(record);
  }

  async touchLastLogin(id: string, at: Date): Promise<void> {
    await this.prisma.adminUser.update({ where: { id }, data: { lastLoginAt: at } });
  }

  async changePassword(
    id: string,
    passwordHash: string,
    expectedVersion: number,
  ): Promise<AdminUser | null> {
    // Escritura condicional: solo cambia si la versión sigue siendo la esperada (atómica en Postgres).
    const { count } = await this.prisma.adminUser.updateMany({
      where: { id, sessionVersion: expectedVersion },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (count === 0) return null;
    return this.findById(id);
  }
}
