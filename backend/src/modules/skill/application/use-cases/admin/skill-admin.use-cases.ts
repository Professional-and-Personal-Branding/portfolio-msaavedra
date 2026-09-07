import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import { NewSkillCategoryProps } from '../../../domain/entities/skill-category.entity';
import { NewSkillProps } from '../../../domain/entities/skill.entity';
import {
  SkillCategoryNotFoundError,
  SkillNotFoundError,
} from '../../../domain/errors/skill.errors';
import {
  SKILL_CATEGORY_REPOSITORY,
  SkillCategoryRepository,
} from '../../../domain/repositories/skill-category.repository';
import { AdminSkillCategoryOutput, AdminSkillOutput } from '../../dto/skill.admin-output';
import { toAdminSkillCategoryOutput, toAdminSkillOutput } from '../../mappers/skill.admin-mapper';

@Injectable()
export class ListSkillCategoriesAdminUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) private readonly repo: SkillCategoryRepository) {}

  async execute(): Promise<Ok<AdminSkillCategoryOutput[]>> {
    return ok((await this.repo.findAll()).map(toAdminSkillCategoryOutput));
  }
}

@Injectable()
export class CreateSkillCategoryUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) private readonly repo: SkillCategoryRepository) {}

  async execute(props: NewSkillCategoryProps): Promise<Ok<AdminSkillCategoryOutput>> {
    return ok(toAdminSkillCategoryOutput(await this.repo.create(props)));
  }
}

@Injectable()
export class UpdateSkillCategoryUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) private readonly repo: SkillCategoryRepository) {}

  async execute(input: {
    id: string;
    changes: Partial<NewSkillCategoryProps>;
  }): Promise<Result<AdminSkillCategoryOutput, SkillCategoryNotFoundError>> {
    const existing = await this.repo.findById(input.id);
    if (!existing) return fail(new SkillCategoryNotFoundError(input.id));
    const saved = await this.repo.update(existing.with(input.changes));
    if (!saved) return fail(new SkillCategoryNotFoundError(input.id));
    return ok(toAdminSkillCategoryOutput(saved));
  }
}

@Injectable()
export class DeleteSkillCategoryUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) private readonly repo: SkillCategoryRepository) {}

  async execute(input: { id: string }): Promise<Result<void, SkillCategoryNotFoundError>> {
    const deleted = await this.repo.delete(input.id);
    if (!deleted) return fail(new SkillCategoryNotFoundError(input.id));
    return ok(undefined);
  }
}

@Injectable()
export class CreateSkillUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) private readonly repo: SkillCategoryRepository) {}

  async execute(input: {
    categoryId: string;
    props: NewSkillProps;
  }): Promise<Result<AdminSkillOutput, SkillCategoryNotFoundError>> {
    const category = await this.repo.findById(input.categoryId);
    if (!category) return fail(new SkillCategoryNotFoundError(input.categoryId));
    const created = await this.repo.createSkill(input.categoryId, input.props);
    return ok(toAdminSkillOutput(created, input.categoryId));
  }
}

export interface UpdateSkillInput {
  id: string;
  changes: Partial<NewSkillProps & { categoryId: string }>;
}

@Injectable()
export class UpdateSkillUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) private readonly repo: SkillCategoryRepository) {}

  async execute(
    input: UpdateSkillInput,
  ): Promise<Result<AdminSkillOutput, SkillNotFoundError | SkillCategoryNotFoundError>> {
    const existing = await this.repo.findSkillById(input.id);
    if (!existing) return fail(new SkillNotFoundError(input.id));

    if (input.changes.categoryId !== undefined) {
      const target = await this.repo.findById(input.changes.categoryId);
      if (!target) return fail(new SkillCategoryNotFoundError(input.changes.categoryId));
    }

    const saved = await this.repo.updateSkill(existing.with(input.changes));
    if (!saved) return fail(new SkillNotFoundError(input.id));
    return ok(toAdminSkillOutput(saved));
  }
}

@Injectable()
export class DeleteSkillUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) private readonly repo: SkillCategoryRepository) {}

  async execute(input: { id: string }): Promise<Result<void, SkillNotFoundError>> {
    const deleted = await this.repo.deleteSkill(input.id);
    if (!deleted) return fail(new SkillNotFoundError(input.id));
    return ok(undefined);
  }
}
