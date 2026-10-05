import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewAggregate,
  ProfileViewRepository,
} from '../../domain/repositories/profile-view.repository';

export const DEFAULT_RANGE_DAYS = 30;

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

/** Lectura agregada de visitas (spec `profile-view-analytics`); default: últimos 30 días. */
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
    const aggregate = await this.views.aggregate({ from, to });
    return ok({ from: from.toISOString(), to: to.toISOString(), ...aggregate });
  }
}
