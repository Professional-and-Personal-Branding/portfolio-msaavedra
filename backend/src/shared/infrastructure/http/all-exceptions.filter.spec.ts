import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter, type ErrorBody } from './all-exceptions.filter';

interface Captured {
  status: number;
  body: ErrorBody;
}

function makeHost(requestId?: string): { host: ArgumentsHost; captured: Captured } {
  const captured = {} as Captured;
  const response = {
    headersSent: false,
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: ErrorBody) {
      captured.body = body;
    },
  };
  const request = { method: 'GET', url: '/api/x', id: requestId };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
  });

  it('conserva status y mensaje de los errores de dominio, y agrega requestId y timestamp', () => {
    const { host, captured } = makeHost('req-1');
    filter.catch(new NotFoundException('Perfil "x" no encontrado'), host);

    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({
      statusCode: 404,
      message: 'Perfil "x" no encontrado',
      error: 'Not Found',
      requestId: 'req-1',
      timestamp: expect.any(String) as string,
    });
    expect(Date.parse(captured.body.timestamp)).not.toBeNaN();
  });

  it('conserva la lista de mensajes de class-validator', () => {
    const { host, captured } = makeHost();
    filter.catch(new BadRequestException(['email must be an email', 'password too short']), host);

    expect(captured.status).toBe(400);
    expect(captured.body.message).toEqual(['email must be an email', 'password too short']);
    expect(captured.body.error).toBe('Bad Request');
    expect(captured.body).not.toHaveProperty('requestId');
  });

  it('un error cualquiera se convierte en 500 genérico, sin stack', () => {
    const { host, captured } = makeHost('req-2');
    filter.catch(new Error('connect ECONNREFUSED 127.0.0.1:5432'), host);

    expect(captured.status).toBe(500);
    expect(captured.body.message).toBe('Error interno del servidor');
    expect(captured.body.error).toBe('Internal Server Error');
    expect(JSON.stringify(captured.body)).not.toContain('ECONNREFUSED');
    expect(captured.body).not.toHaveProperty('stack');
  });

  it('no filtra detalles de la base ni SQL', () => {
    const { host, captured } = makeHost();
    const prismaError = Object.assign(
      new Error(
        'Invalid `prisma.curatedProfile.findUnique()` invocation: SELECT "public"."CuratedProfile"."accessToken"',
      ),
      { code: 'P2021', clientVersion: '6.19.3' },
    );
    filter.catch(prismaError, host);

    const serialized = JSON.stringify(captured.body).toLowerCase();
    expect(serialized).not.toContain('prisma');
    expect(serialized).not.toContain('select');
    expect(serialized).not.toContain('p2021');
    expect(serialized).not.toContain('accesstoken');
  });

  it('un 5xx previsto tampoco cuenta por qué falló', () => {
    const { host, captured } = makeHost();
    filter.catch(new HttpException('El pool de conexiones está agotado', 503), host);

    expect(captured.status).toBe(503);
    expect(captured.body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(captured.body)).not.toContain('pool');
  });

  it('registra el stack completo en el log pero nunca en la respuesta', () => {
    const { host, captured } = makeHost('req-3');
    const error = new Error('detalle interno');
    const spy = jest.spyOn(filter['logger'], 'error');

    filter.catch(error, host);

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('req-3'), error.stack);
    expect(JSON.stringify(captured.body)).not.toContain('detalle interno');
  });

  it('no intenta responder si las cabeceras ya se enviaron', () => {
    const { host, captured } = makeHost();
    const response = host.switchToHttp().getResponse<{ headersSent: boolean }>();
    response.headersSent = true;

    filter.catch(new Error('tarde'), host);

    expect(captured.status).toBeUndefined();
  });
});
