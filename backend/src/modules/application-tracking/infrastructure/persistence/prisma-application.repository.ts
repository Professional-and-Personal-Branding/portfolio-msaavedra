import { Injectable } from '@nestjs/common';
import { Application as ApplicationRow, Prisma } from '@prisma/client';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { ApplicationStatus } from '../../domain/application-status';
import { Application, NewApplicationProps } from '../../domain/entities/application.entity';
import { ApplicationNotFoundError } from '../../domain/errors/application-not-found.error';
import { ShareLinkAlreadyTrackedError } from '../../domain/errors/share-link-already-tracked.error';
import {
  ApplicationFilter,
  ApplicationRepository,
  ApplicationWithRefs,
} from '../../domain/repositories/application.repository';

/** Una consulta trae el `slug` del perfil y lo que la lista muestra del enlace (D8). */
const WITH_REFS = {
  curatedProfile: { select: { slug: true } },
  shareLink: { select: { id: true, label: true, code: true, revokedAt: true } },
} satisfies Prisma.ApplicationInclude;

type ApplicationRowWithRefs = Prisma.ApplicationGetPayload<{ include: typeof WITH_REFS }>;

/** `AAAA-MM-DD` ↔ columna `DATE`: se escribe y se lee como medianoche UTC. */
function dayToDate(day: string | null): Date | null {
  return day === null ? null : new Date(`${day}T00:00:00.000Z`);
}

function toApplication(row: ApplicationRow): Application {
  return new Application({
    id: row.id,
    company: row.company,
    role: row.role,
    jobUrl: row.jobUrl,
    portal: row.portal,
    notes: row.notes,
    status: row.status,
    appliedAt: row.appliedAt === null ? null : row.appliedAt.toISOString().slice(0, 10),
    statusChangedAt: row.statusChangedAt,
    curatedProfileId: row.curatedProfileId,
    shareLinkId: row.shareLinkId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Fila con referencias → lectura con referencias del dominio. */
export function toApplicationWithRefs(row: ApplicationRowWithRefs): ApplicationWithRefs {
  return {
    application: toApplication(row),
    profileSlug: row.curatedProfile?.slug ?? null,
    shareLink: row.shareLink
      ? {
          id: row.shareLink.id,
          label: row.shareLink.label,
          code: row.shareLink.code,
          revoked: row.shareLink.revokedAt !== null,
        }
      : null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  // P2002 sobre `shareLinkId`: el único índice único del modelo además de la clave.
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class PrismaApplicationRepository implements ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ApplicationFilter): Promise<ApplicationWithRefs[]> {
    const statuses = filter.statuses ?? [];
    const rows = await this.prisma.application.findMany({
      where: statuses.length > 0 ? { status: { in: [...statuses] } } : undefined,
      include: WITH_REFS,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toApplicationWithRefs);
  }

  async findById(id: string): Promise<ApplicationWithRefs | null> {
    const row = await this.prisma.application.findUnique({ where: { id }, include: WITH_REFS });
    return row ? toApplicationWithRefs(row) : null;
  }

  async create(
    props: NewApplicationProps,
  ): Promise<Result<ApplicationWithRefs, ShareLinkAlreadyTrackedError>> {
    try {
      const row = await this.prisma.application.create({
        data: {
          company: props.company,
          role: props.role,
          jobUrl: props.jobUrl,
          portal: props.portal,
          notes: props.notes,
          status: props.status,
          appliedAt: dayToDate(props.appliedAt),
          statusChangedAt: props.statusChangedAt,
          curatedProfileId: props.curatedProfileId,
          shareLinkId: props.shareLinkId,
        },
        include: WITH_REFS,
      });
      return ok(toApplicationWithRefs(row));
    } catch (error) {
      if (isUniqueViolation(error)) return fail(new ShareLinkAlreadyTrackedError());
      throw error;
    }
  }

  async update(
    application: Application,
  ): Promise<Result<ApplicationWithRefs, ShareLinkAlreadyTrackedError | ApplicationNotFoundError>> {
    try {
      const row = await this.prisma.application.update({
        where: { id: application.id },
        data: {
          company: application.company,
          role: application.role,
          jobUrl: application.jobUrl,
          portal: application.portal,
          notes: application.notes,
          status: application.status,
          appliedAt: dayToDate(application.appliedAt),
          statusChangedAt: application.statusChangedAt,
          curatedProfileId: application.curatedProfileId,
          shareLinkId: application.shareLinkId,
        },
        include: WITH_REFS,
      });
      return ok(toApplicationWithRefs(row));
    } catch (error) {
      if (isUniqueViolation(error)) return fail(new ShareLinkAlreadyTrackedError());
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return fail(new ApplicationNotFoundError(application.id));
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.application.delete({ where: { id } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  async countByStatus(): Promise<Partial<Record<ApplicationStatus, number>>> {
    const rows = await this.prisma.application.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  async isShareLinkTracked(shareLinkId: string, exceptId?: string): Promise<boolean> {
    const row = await this.prisma.application.findFirst({
      where: { shareLinkId, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
      select: { id: true },
    });
    return row !== null;
  }
}
