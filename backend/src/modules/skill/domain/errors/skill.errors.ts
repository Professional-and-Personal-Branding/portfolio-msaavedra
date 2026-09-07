import { NotFoundError } from '../../../../shared/domain/errors';

export class SkillCategoryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Categoría de skills', id);
  }
}

export class SkillNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Skill', id);
  }
}
