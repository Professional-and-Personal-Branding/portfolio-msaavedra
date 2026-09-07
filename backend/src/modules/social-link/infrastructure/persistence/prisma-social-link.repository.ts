import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { SocialLink } from '../../domain/entities/social-link.entity';
import { SocialLinkRepository } from '../../domain/repositories/social-link.repository';
import { toSocialLinkEntity } from './social-link.prisma-mapper';

@Injectable()
export class PrismaSocialLinkRepository implements SocialLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllVisible(): Promise<SocialLink[]> {
    const records = await this.prisma.socialLink.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    });
    return records.map(toSocialLinkEntity);
  }
}
