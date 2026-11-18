import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma.service';
import {
  AiBudgetRepository,
  BudgetMonthSnapshot,
  ReserveOutcome,
  ReserveRequest,
  SettleRequest,
} from '../../application/ports/ai-repositories';
import { toCreateData, toFinalData } from './ai-run.mapper';

/**
 * Contador mensual (D8). Las fechas se pasan como texto ISO con `::timestamp`: las columnas son
 * `timestamp(3)` en UTC y así la comparación no depende de la zona horaria de la sesión.
 */
@Injectable()
export class PrismaAiBudgetRepository implements AiBudgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(request: ReserveRequest): Promise<ReserveOutcome> {
    const { run, month, capMicroUsd, now } = request;
    const amount = run.props.reservedMicroUsd;
    const nowIso = now.toISOString();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "AiBudgetMonth" ("month", "updatedAt")
        VALUES (${month}, ${nowIso}::timestamp)
        ON CONFLICT ("month") DO NOTHING`;
      // Una sola sentencia condicional: Postgres serializa los UPDATE sobre la misma fila, así que
      // dos reservas simultáneas (incluso de dos instancias) no pueden sumar más que el tope.
      const granted = await tx.$queryRaw<Array<{ month: string }>>`
        UPDATE "AiBudgetMonth"
           SET "reservedMicroUsd" = "reservedMicroUsd" + ${amount}::int,
               "updatedAt" = ${nowIso}::timestamp
         WHERE "month" = ${month}
           AND ("providerBlockedUntil" IS NULL OR "providerBlockedUntil" <= ${nowIso}::timestamp)
           AND "spentMicroUsd" + "reservedMicroUsd" + ${amount}::int <= ${capMicroUsd}::int
        RETURNING "month"`;
      if (granted.length === 0) {
        const row = await tx.aiBudgetMonth.findUnique({ where: { month } });
        if (row?.providerBlockedUntil && row.providerBlockedUntil > now) {
          return { kind: 'providerBlocked', until: row.providerBlockedUntil } as const;
        }
        return { kind: 'exhausted' } as const;
      }
      await tx.aiRun.create({ data: toCreateData(run) });
      return { kind: 'granted' } as const;
    });
  }

  async settle(request: SettleRequest): Promise<boolean> {
    const { run, month, releasedMicroUsd, chargedMicroUsd } = request;
    const nowIso = (run.props.finishedAt ?? new Date()).toISOString();
    return this.prisma.$transaction(async (tx) => {
      // Si el barrido ya la pasó a ABANDONED, su reserva ya se imputó: no se concilia dos veces.
      const closed = await tx.aiRun.updateMany({
        where: { id: run.id, status: 'RESERVED' },
        data: toFinalData(run),
      });
      if (closed.count === 0) return false;
      await tx.$executeRaw`
        UPDATE "AiBudgetMonth"
           SET "reservedMicroUsd" = "reservedMicroUsd" - ${releasedMicroUsd}::int,
               "spentMicroUsd" = "spentMicroUsd" + ${chargedMicroUsd}::int,
               "updatedAt" = ${nowIso}::timestamp
         WHERE "month" = ${month}`;
      return true;
    });
  }

  async abandonExpired(now: Date): Promise<number> {
    const expired = await this.prisma.aiRun.findMany({
      where: { status: 'RESERVED', reservationExpiresAt: { lte: now } },
      select: { id: true, budgetMonth: true, reservedMicroUsd: true },
    });
    const nowIso = now.toISOString();
    let abandoned = 0;
    for (const run of expired) {
      const done = await this.prisma.$transaction(async (tx) => {
        const closed = await tx.aiRun.updateMany({
          where: { id: run.id, status: 'RESERVED' },
          data: {
            status: 'ABANDONED',
            costMicroUsd: run.reservedMicroUsd,
            failureKind: 'Abandoned',
            failureMessage: 'la reserva venció sin conciliar',
            finishedAt: now,
          },
        });
        if (closed.count === 0) return false;
        await tx.$executeRaw`
          UPDATE "AiBudgetMonth"
             SET "reservedMicroUsd" = "reservedMicroUsd" - ${run.reservedMicroUsd}::int,
                 "spentMicroUsd" = "spentMicroUsd" + ${run.reservedMicroUsd}::int,
                 "updatedAt" = ${nowIso}::timestamp
           WHERE "month" = ${run.budgetMonth}`;
        return true;
      });
      if (done) abandoned += 1;
    }
    return abandoned;
  }

  async blockProvider(month: string, until: Date, reason: string): Promise<void> {
    await this.prisma.aiBudgetMonth.upsert({
      where: { month },
      create: { month, providerBlockedUntil: until, providerBlockReason: reason },
      update: { providerBlockedUntil: until, providerBlockReason: reason },
    });
  }

  async getMonth(month: string): Promise<BudgetMonthSnapshot | null> {
    const row = await this.prisma.aiBudgetMonth.findUnique({ where: { month } });
    if (!row) return null;
    return {
      month: row.month,
      spentMicroUsd: row.spentMicroUsd,
      reservedMicroUsd: row.reservedMicroUsd,
      providerBlockedUntil: row.providerBlockedUntil,
      providerBlockReason: row.providerBlockReason,
    };
  }
}
