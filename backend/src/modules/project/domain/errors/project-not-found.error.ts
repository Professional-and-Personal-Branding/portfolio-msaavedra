import { NotFoundError } from '../../../../shared/domain/errors';

export class ProjectNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Proyecto', id);
  }
}
