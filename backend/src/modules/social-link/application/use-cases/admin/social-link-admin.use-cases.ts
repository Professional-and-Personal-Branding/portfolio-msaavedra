import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import { NewSocialLinkProps } from '../../../domain/entities/social-link.entity';
import { SocialLinkNotFoundError } from '../../../domain/errors/social-link-not-found.error';
import {
  SOCIAL_LINK_REPOSITORY,
  SocialLinkRepository,
} from '../../../domain/repositories/social-link.repository';
import { validateSocialLink } from '../../../domain/services/validate-social-link';
import { AdminSocialLinkOutput } from '../../dto/social-link.admin-output';
import { toAdminSocialLinkOutput } from '../../mappers/social-link.admin-mapper';

/** Listado del backoffice: todos (incluidos ocultos), por `order`, datos crudos. */
@Injectable()
export class ListAllSocialLinksUseCase {
  constructor(@Inject(SOCIAL_LINK_REPOSITORY) private readonly links: SocialLinkRepository) {}

  async execute(): Promise<Ok<AdminSocialLinkOutput[]>> {
    return ok((await this.links.findAll()).map(toAdminSocialLinkOutput));
  }
}

@Injectable()
export class GetSocialLinkAdminUseCase {
  constructor(@Inject(SOCIAL_LINK_REPOSITORY) private readonly links: SocialLinkRepository) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminSocialLinkOutput, SocialLinkNotFoundError>> {
    const found = await this.links.findById(input.id);
    if (!found) return fail(new SocialLinkNotFoundError(input.id));
    return ok(toAdminSocialLinkOutput(found));
  }
}

@Injectable()
export class CreateSocialLinkUseCase {
  constructor(@Inject(SOCIAL_LINK_REPOSITORY) private readonly links: SocialLinkRepository) {}

  async execute(
    props: NewSocialLinkProps,
  ): Promise<Result<AdminSocialLinkOutput, ValidationError>> {
    const valid = validateSocialLink(props);
    if (!valid.ok) return valid;
    return ok(toAdminSocialLinkOutput(await this.links.create(props)));
  }
}

export interface UpdateSocialLinkInput {
  id: string;
  changes: Partial<NewSocialLinkProps>;
}

@Injectable()
export class UpdateSocialLinkUseCase {
  constructor(@Inject(SOCIAL_LINK_REPOSITORY) private readonly links: SocialLinkRepository) {}

  async execute(
    input: UpdateSocialLinkInput,
  ): Promise<Result<AdminSocialLinkOutput, SocialLinkNotFoundError | ValidationError>> {
    const existing = await this.links.findById(input.id);
    if (!existing) return fail(new SocialLinkNotFoundError(input.id));

    const updated = existing.with(input.changes);
    const valid = validateSocialLink(updated.toProps());
    if (!valid.ok) return valid;

    const saved = await this.links.update(updated);
    if (!saved) return fail(new SocialLinkNotFoundError(input.id));
    return ok(toAdminSocialLinkOutput(saved));
  }
}

@Injectable()
export class DeleteSocialLinkUseCase {
  constructor(@Inject(SOCIAL_LINK_REPOSITORY) private readonly links: SocialLinkRepository) {}

  async execute(input: { id: string }): Promise<Result<void, SocialLinkNotFoundError>> {
    const deleted = await this.links.delete(input.id);
    if (!deleted) return fail(new SocialLinkNotFoundError(input.id));
    return ok(undefined);
  }
}
