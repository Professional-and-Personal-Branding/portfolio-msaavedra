import { Injectable } from '@nestjs/common';
import { IntegrationSetting as SettingRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import { IntegrationSetting, PauseReason } from '../../domain/entities/integration-setting.entity';
import { IntegrationSettingRepository } from '../../domain/repositories/integration-setting.repository';

function toSetting(row: SettingRow): IntegrationSetting {
  return new IntegrationSetting({
    provider: row.provider,
    enabled: row.enabled,
    pausedUntil: row.pausedUntil,
    pauseReason: row.pauseReason as PauseReason | null,
    consecutiveFailures: row.consecutiveFailures,
    lastSuccessAt: row.lastSuccessAt,
    enabledSince: row.enabledSince,
    updatedAt: row.updatedAt,
  });
}

@Injectable()
export class PrismaIntegrationSettingRepository implements IntegrationSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(provider: string, now: Date): Promise<IntegrationSetting> {
    const row = await this.prisma.integrationSetting.upsert({
      where: { provider },
      create: { provider, enabledSince: now },
      update: {},
    });
    return toSetting(row);
  }

  async getOrCreateMany(
    providers: readonly string[],
    now: Date,
  ): Promise<ReadonlyMap<string, IntegrationSetting>> {
    const list = [...providers];
    await this.prisma.integrationSetting.createMany({
      data: list.map((provider) => ({ provider, enabledSince: now })),
      skipDuplicates: true,
    });
    const rows = await this.prisma.integrationSetting.findMany({
      where: { provider: { in: list } },
    });
    return new Map(rows.map((row) => [row.provider, toSetting(row)]));
  }

  async saveHealth(setting: IntegrationSetting): Promise<void> {
    const p = setting.props;
    await this.prisma.integrationSetting.update({
      where: { provider: p.provider },
      data: {
        pausedUntil: p.pausedUntil,
        pauseReason: p.pauseReason,
        consecutiveFailures: p.consecutiveFailures,
        lastSuccessAt: p.lastSuccessAt,
      },
    });
  }

  async saveEnabled(setting: IntegrationSetting): Promise<void> {
    const p = setting.props;
    await this.prisma.integrationSetting.update({
      where: { provider: p.provider },
      data: {
        enabled: p.enabled,
        enabledSince: p.enabledSince,
        pausedUntil: p.pausedUntil,
        pauseReason: p.pauseReason,
        consecutiveFailures: p.consecutiveFailures,
      },
    });
  }
}
