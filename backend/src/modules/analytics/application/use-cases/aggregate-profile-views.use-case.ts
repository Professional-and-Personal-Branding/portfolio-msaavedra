import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewAggregate,
  ProfileViewRepository,
} from '../../domain/repositories/profile-view.repository';

export const DEFAULT_RANGE_DAYS = 30;

const DAY_MS = 86_400_000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface AggregateProfileViewsInput {
  from?: Date;
  to?: Date;
  /** Inyectable para tests. */
  now?: Date;
}

export interface ProfileViewsOutput extends ProfileViewAggregate {
  from: string;
  to: string;
}

/**
 * Lectura agregada de visitas (spec `profile-view-analytics`). El rango es cerrado y de días UTC
 * completos: `from` cuenta desde las 00:00 de su día y `to` hasta el final del suyo (default: los
 * 30 días que terminan hoy). Al repositorio le llega semiabierto, `[from, día siguiente a to)`.
 */
@Injectable()
export class AggregateProfileViewsUseCase {
  constructor(@Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository) {}

  async execute(
    input: AggregateProfileViewsInput,
  ): Promise<Result<ProfileViewsOutput, ValidationError>> {
    const toDay = startOfUtcDay(input.to ?? input.now ?? new Date());
    const from = input.from
      ? startOfUtcDay(input.from)
      : new Date(toDay.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
    if (from > toDay) {
      return fail(new ValidationError('from no puede ser posterior a to', ['from', 'to']));
    }
    const toExclusive = new Date(toDay.getTime() + DAY_MS);
    const aggregate = await this.views.aggregate({ from, to: toExclusive });
    return ok({
      from: from.toISOString(),
      to: new Date(toExclusive.getTime() - 1).toISOString(),
      ...aggregate,
    });
  }
}
