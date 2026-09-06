import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DomainError, NotFoundError } from '../../domain/errors';
import { toHttpException } from './domain-error.mapper';

class WeirdError extends DomainError {
  readonly code = 'WEIRD';
  constructor() {
    super('detalle interno sensible');
  }
}

describe('toHttpException', () => {
  it('NotFoundError → 404 con el mensaje del dominio', () => {
    const ex = toHttpException(new NotFoundError('Experiencia', 'abc'));
    expect(ex).toBeInstanceOf(NotFoundException);
    expect(ex.getStatus()).toBe(404);
    expect(ex.getResponse()).toMatchObject({
      statusCode: 404,
      message: 'Experiencia con id "abc" no encontrado',
      error: 'Not Found',
    });
  });

  it('error de dominio no previsto → 500 sin filtrar detalles', () => {
    const ex = toHttpException(new WeirdError());
    expect(ex).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify(ex.getResponse())).not.toContain('sensible');
  });
});
