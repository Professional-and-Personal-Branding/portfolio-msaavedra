import { NotFoundError } from '../../../../shared/domain/errors';

export class LanguageNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Idioma', id);
  }
}
