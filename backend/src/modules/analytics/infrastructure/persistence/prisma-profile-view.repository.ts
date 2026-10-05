import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  DateRange,
  NewProfileView,
  ProfileViewAggregate,
  ProfileViewRepository,
} from '../../domain/repositories/profile-view.repository';

interface DayRow {
  day: Date | string;
  views: bigint | number;
}

@Injectable()
export class PrismaProfileViewRepository implements ProfileViewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(view: NewProfileView): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.profileView.create({
        data: {
          curatedProfileId: view.curatedProfileId,
          locale: view.locale ?? null,
          referrer: view.referrer ?? null,
          userAgent: view.userAgent ?? null,
          ipHash: view.ipHash ?? null,
        },
      }),
      this.prisma.curatedProfile.update({
        where: { id: view.curatedProfileId },
        data: { views: { increment: 1 } },
      }),
    ]);
  }

  async aggregate(range: DateRange): Promise<ProfileViewAggregate> {
    const where: Prisma.ProfileViewWhereInput = { viewedAt: { gte: range.from, lt: range.to } };

    const [total, byProfileRaw, byLocaleRaw, byDayRaw] = await Promise.all([
      this.prisma.profileView.count({ where }),
      this.prisma.profileView.groupBy({
        by: ['curatedProfileId'],
        where,
        _count: { _all: true },
        orderBy: { _count: { curatedProfileId: 'desc' } },
      }),
      this.prisma.profileView.groupBy({ by: ['locale'], where, _count: { _all: true } }),
      // Único SQL crudo del proyecto: agrupación por día (date_trunc) — encapsulado aquí.
      this.prisma.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', "viewedAt") AS day, COUNT(*)::int AS views
        FROM "ProfileView"
        WHERE "viewedAt" >= ${range.from} AND "viewedAt" < ${range.to}
        GROUP BY 1
        ORDER BY 1 ASC`,
    ]);

    const ids = byProfileRaw.map((r) => r.curatedProfileId);
    const profiles = ids.length
      ? await this.prisma.curatedProfile.findMany({
          where: { id: { in: ids } },
          select: { id: true, slug: true },
        })
      : [];
    const slugById = new Map(profiles.map((p) => [p.id, p.slug]));

    return {
      total,
      byProfile: byProfileRaw
        .map((r) => ({
          slug: slugById.get(r.curatedProfileId) ?? r.curatedProfileId,
          views: r._count._all,
        }))
        .sort((a, b) => b.views - a.views),
      byLocale: byLocaleRaw
        .map((r) => ({ locale: r.locale ?? 'unknown', views: r._count._all }))
        .sort((a, b) => b.views - a.views),
      byDay: byDayRaw.map((r) => ({
        day: (r.day instanceof Date ? r.day : new Date(r.day)).toISOString().slice(0, 10),
        views: Number(r.views),
      })),
    };
  }
}
