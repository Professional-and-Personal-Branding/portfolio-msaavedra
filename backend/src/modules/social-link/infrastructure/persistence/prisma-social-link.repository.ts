import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { NewSocialLinkProps, SocialLink } from '../../domain/entities/social-link.entity';
import { SocialLinkRepository } from '../../domain/repositories/social-link.repository';
import { toSocialLinkData, toSocialLinkEntity } from './social-link.prisma-mapper';

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

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

  async findAll(): Promise<SocialLink[]> {
    const records = await this.prisma.socialLink.findMany({ orderBy: { order: 'asc' } });
    return records.map(toSocialLinkEntity);
  }

  async findById(id: string): Promise<SocialLink | null> {
    const record = await this.prisma.socialLink.findUnique({ where: { id } });
    return record ? toSocialLinkEntity(record) : null;
  }

  async create(props: NewSocialLinkProps): Promise<SocialLink> {
    const record = await this.prisma.socialLink.create({ data: toSocialLinkData(props) });
    return toSocialLinkEntity(record);
  }

  async update(socialLink: SocialLink): Promise<SocialLink | null> {
    try {
      const record = await this.prisma.socialLink.update({
        where: { id: socialLink.id },
        data: toSocialLinkData(socialLink.toProps()),
      });
      return toSocialLinkEntity(record);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.socialLink.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}
