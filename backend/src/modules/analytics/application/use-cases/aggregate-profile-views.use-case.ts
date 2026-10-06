import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewAggregate,
  ProfileViewRepository,
} from '../../domain/repositories/profile-view.repository';
import { aggregateByReferrer } from '../../domain/services/normalize-referrer';

export const DEFAULT_RANGE_DAYS = 30;

export interface AggregateProfileViewsInput {
  from?: Date;
  to?: Date;
  /** Inyectable para tests. */
  now?: Date;
  /** URL pública del sitio (`FRONTEND_URL`): sus visitas cuentan como origen `interno`. */
  siteUrl?: string | null;
}

export interface ProfileViewsOutput extends ProfileViewAggregate {
  from: string;
  to: string;
  /** Por origen normalizado (D5), descendente. Su suma es `total`. */
  byReferrer: { referrer: string; views: number }[];
}

/**
 * Lectura agregada de visitas (spec `profile-view-analytics`); default: últimos
 * 30 días. El origen se normaliza acá, sobre el `referrer` ya guardado.
 */
@Injectable()
export class AggregateProfileViewsUseCase {
  constructor(@Inject(PROFILE_VIEW_REPOSITORY) private readonly views: ProfileViewRepository) {}

  async execute(
    input: AggregateProfileViewsInput,
  ): Promise<Result<ProfileViewsOutput, ValidationError>> {
    const now = input.now ?? new Date();
    const to = input.to ?? now;
    const from = input.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);
    if (from > to) {
      return fail(new ValidationError('from no puede ser posterior a to', ['from', 'to']));
    }
    const [aggregate, referrers] = await Promise.all([
      this.views.aggregate({ from, to }),
      this.views.countByReferrer({ from, to }),
    ]);
    return ok({
      from: from.toISOString(),
      to: to.toISOString(),
      ...aggregate,
      byReferrer: aggregateByReferrer(referrers, input.siteUrl ?? null),
    });
  }
}
