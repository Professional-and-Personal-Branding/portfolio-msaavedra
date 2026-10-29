import { Injectable } from '@nestjs/common';
import { Prisma, ShareLink as ShareLinkRow } from '@prisma/client';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { NewShareLinkProps, ShareLink } from '../../domain/entities/share-link.entity';
import { ShareCodeCollisionError } from '../../domain/errors/share-code-collision.error';
import { ShareLinkRepository } from '../../domain/repositories/share-link.repository';

/** Fila de Prisma → entidad de dominio. */
export function toShareLink(row: ShareLinkRow): ShareLink {
  return new ShareLink({
    id: row.id,
    code: row.code,
    curatedProfileId: row.curatedProfileId,
    label: row.label,
    portal: row.portal,
    kind: row.kind,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  });
}

@Injectable()
export class PrismaShareLinkRepository implements ShareLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<ShareLink | null> {
    const row = await this.prisma.shareLink.findUnique({ where: { code } });
    return row ? toShareLink(row) : null;
  }

  async findById(id: string): Promise<ShareLink | null> {
    const row = await this.prisma.shareLink.findUnique({ where: { id } });
    return row ? toShareLink(row) : null;
  }

  async listByProfile(curatedProfileId: string): Promise<ShareLink[]> {
    const rows = await this.prisma.shareLink.findMany({
      where: { curatedProfileId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toShareLink);
  }

  async create(props: NewShareLinkProps): Promise<Result<ShareLink, ShareCodeCollisionError>> {
    try {
      const row = await this.prisma.shareLink.create({
        data: {
          code: props.code,
          curatedProfileId: props.curatedProfileId,
          label: props.label,
          portal: props.portal,
          kind: props.kind,
        },
      });
      return ok(toShareLink(row));
    } catch (error) {
      // P2002 sobre `code`: el único índice único del modelo además de la clave.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return fail(new ShareCodeCollisionError());
      }
      throw error;
    }
  }

  async save(link: ShareLink): Promise<ShareLink | null> {
    try {
      const row = await this.prisma.shareLink.update({
        where: { id: link.id },
        data: { label: link.label, revokedAt: link.revokedAt },
      });
      return toShareLink(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async findActiveLinkedIn(curatedProfileId: string): Promise<ShareLink | null> {
    const row = await this.prisma.shareLink.findFirst({
      where: { curatedProfileId, kind: 'LINKEDIN_POST', revokedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return row ? toShareLink(row) : null;
  }
}
