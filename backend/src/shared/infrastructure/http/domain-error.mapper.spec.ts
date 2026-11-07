import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccessDeniedError,
  ConflictError,
  DomainError,
  NotFoundError,
  RuleViolationError,
  ValidationError,
} from '../../domain/errors';
import { toHttpException } from './domain-error.mapper';

class SampleRuleViolation extends RuleViolationError {
  readonly code = 'SAMPLE_RULE';
  constructor() {
    super('Transición de estado inválida: DRAFT → OFFER');
  }
}

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
    expect(ex.getResponse()).toMatchObject({
      statusCode: 404,
      message: 'Experiencia con id "abc" no encontrado',
      error: 'Not Found',
    });
  });

  it('AccessDeniedError → 401 Unauthorized', () => {
    const ex = toHttpException(new AccessDeniedError('Perfil curado'));
    expect(ex).toBeInstanceOf(UnauthorizedException);
    expect(ex.getResponse()).toMatchObject({ statusCode: 401, error: 'Unauthorized' });
  });

  it('ValidationError → 400 Bad Request', () => {
    const ex = toHttpException(new ValidationError('accessToken es obligatorio', ['accessToken']));
    expect(ex).toBeInstanceOf(BadRequestException);
    expect(ex.getResponse()).toMatchObject({
      statusCode: 400,
      message: 'accessToken es obligatorio',
      error: 'Bad Request',
    });
  });

  it('ConflictError → 409 Conflict', () => {
    const ex = toHttpException(new ConflictError('Perfil curado', 'slug "all" ya existe'));
    expect(ex).toBeInstanceOf(ConflictException);
    expect(ex.getResponse()).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('RuleViolationError (subclase) → 422 Unprocessable Entity sin stack', () => {
    const ex = toHttpException(new SampleRuleViolation());
    expect(ex).toBeInstanceOf(UnprocessableEntityException);
    expect(ex.getResponse()).toEqual({
      statusCode: 422,
      message: 'Transición de estado inválida: DRAFT → OFFER',
      error: 'Unprocessable Entity',
    });
  });

  it('error de dominio no previsto → 500 sin filtrar detalles', () => {
    const ex = toHttpException(new WeirdError());
    expect(ex).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify(ex.getResponse())).not.toContain('sensible');
  });
});
