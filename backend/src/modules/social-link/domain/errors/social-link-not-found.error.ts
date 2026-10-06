import { NotFoundError } from '../../../../shared/domain/errors';

export class SocialLinkNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Enlace social', id);
  }
}
