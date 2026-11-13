import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  CredentialRecord,
  CredentialRepository,
} from '../../domain/repositories/credential.repository';

@Injectable()
export class PrismaCredentialRepository implements CredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(provider: string): Promise<CredentialRecord | null> {
    return this.prisma.integrationCredential.findUnique({ where: { provider } });
  }

  async listAll(): Promise<CredentialRecord[]> {
    return this.prisma.integrationCredential.findMany({ orderBy: { provider: 'asc' } });
  }

  async upsert(provider: string, ciphertext: string, keyId: string): Promise<void> {
    await this.prisma.integrationCredential.upsert({
      where: { provider },
      create: { provider, ciphertext, keyId },
      update: { ciphertext, keyId },
    });
  }

  async delete(provider: string): Promise<void> {
    await this.prisma.integrationCredential.deleteMany({ where: { provider } });
  }

  async updateIfUnchanged(
    provider: string,
    oldCiphertext: string,
    newCiphertext: string,
    newKeyId: string,
  ): Promise<boolean> {
    const result = await this.prisma.integrationCredential.updateMany({
      where: { provider, ciphertext: oldCiphertext },
      data: { ciphertext: newCiphertext, keyId: newKeyId },
    });
    return result.count === 1;
  }
}
