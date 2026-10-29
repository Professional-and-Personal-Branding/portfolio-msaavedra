import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  DateRange,
  KindCount,
  NewProfileView,
  ProfileViewAggregate,
  ProfileViewRepository,
  ReferrerCount,
  ShareLinkCount,
  ShareLinkOpens,
  SourceCount,
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
          kind: view.kind,
          shareLinkId: view.shareLinkId ?? null,
          source: view.source ?? null,
        },
      }),
      // Solo las visitas de personas suman en `views`; una OWNER o BOT es una sola escritura.
      ...(view.kind === 'HUMAN'
        ? [
            this.prisma.curatedProfile.update({
              where: { id: view.curatedProfileId },
              data: { views: { increment: 1 } },
            }),
          ]
        : []),
    ]);
  }

  async aggregate(range: DateRange): Promise<ProfileViewAggregate> {
    const where: Prisma.ProfileViewWhereInput = {
      viewedAt: { gte: range.from, lte: range.to },
      kind: 'HUMAN',
    };

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
        WHERE "viewedAt" >= ${range.from} AND "viewedAt" <= ${range.to}
          AND "kind" = 'HUMAN'
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

  async countByReferrer(range: DateRange): Promise<ReferrerCount[]> {
    const rows = await this.prisma.profileView.groupBy({
      by: ['referrer'],
      where: { viewedAt: { gte: range.from, lte: range.to }, kind: 'HUMAN' },
      _count: { _all: true },
    });
    return rows.map((r) => ({ referrer: r.referrer, views: r._count._all }));
  }

  async countByKind(range: DateRange): Promise<KindCount[]> {
    const rows = await this.prisma.profileView.groupBy({
      by: ['kind'],
      where: { viewedAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ kind: r.kind, views: r._count._all }));
  }

  async countByShareLink(range: DateRange): Promise<ShareLinkCount[]> {
    const rows = await this.prisma.profileView.groupBy({
      by: ['shareLinkId'],
      where: {
        viewedAt: { gte: range.from, lte: range.to },
        kind: 'HUMAN',
        shareLinkId: { not: null },
      },
      _count: { _all: true },
    });
    const ids = rows.flatMap((r) => (r.shareLinkId === null ? [] : [r.shareLinkId]));
    if (ids.length === 0) return [];
    const links = await this.prisma.shareLink.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        code: true,
        label: true,
        portal: true,
        revokedAt: true,
        curatedProfile: { select: { slug: true } },
      },
    });
    const byId = new Map(links.map((link) => [link.id, link]));
    return rows
      .flatMap((r) => {
        const link = r.shareLinkId === null ? undefined : byId.get(r.shareLinkId);
        if (!link) return [];
        return [
          {
            shareLinkId: link.id,
            code: link.code,
            label: link.label,
            slug: link.curatedProfile.slug,
            portal: link.portal,
            revoked: link.revokedAt !== null,
            views: r._count._all,
          },
        ];
      })
      .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label));
  }

  async countBySource(range: DateRange): Promise<SourceCount[]> {
    const rows = await this.prisma.profileView.groupBy({
      by: ['source'],
      where: {
        viewedAt: { gte: range.from, lte: range.to },
        kind: 'HUMAN',
        source: { not: null },
      },
      _count: { _all: true },
    });
    return rows
      .flatMap((r) => (r.source === null ? [] : [{ source: r.source, views: r._count._all }]))
      .sort((a, b) => b.views - a.views || a.source.localeCompare(b.source));
  }

  async countOpensByShareLink(shareLinkIds: readonly string[]): Promise<ShareLinkOpens[]> {
    if (shareLinkIds.length === 0) return [];
    const rows = await this.prisma.profileView.groupBy({
      by: ['shareLinkId'],
      where: { shareLinkId: { in: [...shareLinkIds] }, kind: 'HUMAN' },
      _count: { _all: true },
      _max: { viewedAt: true },
    });
    return rows.flatMap((r) =>
      r.shareLinkId === null
        ? []
        : [{ shareLinkId: r.shareLinkId, opens: r._count._all, lastOpenedAt: r._max.viewedAt }],
    );
  }
}
