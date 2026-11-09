import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  ApplicationReferenceReader,
  ReferencedProfile,
  ReferencedShareLink,
} from '../../domain/repositories/application-reference.reader';

/** Solo lectura: el CRM no escribe ni perfiles ni enlaces. */
@Injectable()
export class PrismaApplicationReferenceReader implements ApplicationReferenceReader {
  constructor(private readonly prisma: PrismaService) {}

  async findProfile(id: string): Promise<ReferencedProfile | null> {
    return this.prisma.curatedProfile.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
  }

  async findShareLink(id: string): Promise<ReferencedShareLink | null> {
    return this.prisma.shareLink.findUnique({
      where: { id },
      select: {
        id: true,
        curatedProfileId: true,
        kind: true,
        label: true,
        code: true,
        revokedAt: true,
      },
    });
  }
}
