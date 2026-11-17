import {
  buildLoggerOptions,
  isQuietRoute,
  REDACTED_PATHS,
  redactTokenInUrl,
} from './logger.options';

describe('redactTokenInUrl', () => {
  it('oculta el valor del token conservando el resto de la URL', () => {
    expect(redactTokenInUrl('/api/curated-profiles/x?token=secreto')).toBe(
      '/api/curated-profiles/x?token=[Redacted]',
    );
    expect(redactTokenInUrl('/api/x?locale=es&token=secreto&lang=en')).toBe(
      '/api/x?locale=es&token=[Redacted]&lang=en',
    );
  });

  it('no toca URLs sin token', () => {
    expect(redactTokenInUrl('/api/profile?locale=es')).toBe('/api/profile?locale=es');
  });

  it('tolera una URL ausente', () => {
    expect(redactTokenInUrl(undefined)).toBeUndefined();
  });

  it('no confunde otros parámetros que contienen "token"', () => {
    expect(redactTokenInUrl('/api/x?accessTokenHint=1')).toBe('/api/x?accessTokenHint=1');
  });
});

describe('REDACTED_PATHS', () => {
  it('cubre las cabeceras y campos que llevan credenciales', () => {
    expect(REDACTED_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-access-token"]',
        'res.headers["set-cookie"]',
        'req.body.password',
        'req.body.accessToken',
      ]),
    );
  });
});

describe('isQuietRoute', () => {
  it('silencia las sondas del orquestador', () => {
    expect(isQuietRoute('/health')).toBe(true);
    expect(isQuietRoute('/health/live')).toBe(true);
    expect(isQuietRoute('/health?verbose=1')).toBe(true);
  });

  it('no silencia el resto', () => {
    expect(isQuietRoute('/api/profile')).toBe(false);
    expect(isQuietRoute(undefined)).toBe(false);
  });
});

describe('buildLoggerOptions', () => {
  it('en producción emite JSON sin transporte bonito', () => {
    const options = buildLoggerOptions('info', true);
    expect(options.pinoHttp).toMatchObject({ level: 'info' });
    expect((options.pinoHttp as { transport?: unknown }).transport).toBeUndefined();
  });

  it('en desarrollo usa pino-pretty y el nivel pedido', () => {
    const options = buildLoggerOptions('debug', false);
    expect((options.pinoHttp as { transport?: { target: string } }).transport?.target).toBe(
      'pino-pretty',
    );
    expect(options.pinoHttp).toMatchObject({ level: 'debug' });
  });

  it('el serializador de la petición redacta el token de la query', () => {
    const options = buildLoggerOptions('info', true);
    const serializers = (
      options.pinoHttp as {
        serializers: { req: (r: Partial<{ method: string; url: string; id: string }>) => unknown };
      }
    ).serializers;

    expect(serializers.req({ method: 'GET', url: '/api/x?token=abc', id: 'r1' })).toEqual({
      id: 'r1',
      method: 'GET',
      url: '/api/x?token=[Redacted]',
    });
    // Un objeto incompleto no debe romper el logger.
    expect(serializers.req({})).toEqual({ id: undefined, method: undefined, url: undefined });
  });

  it('reutiliza el id que puso el middleware', () => {
    const options = buildLoggerOptions('info', true);
    const genReqId = (options.pinoHttp as { genReqId: (req: unknown) => string }).genReqId;

    expect(genReqId({ id: 'del-middleware' })).toBe('del-middleware');
    expect(genReqId({})).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// add-ai-foundation (D21): la clave de Anthropic jamás se loguea.
describe('REDACTED_PATHS — IA', () => {
  it('redacta x-api-key, apiKey y ANTHROPIC_API_KEY', () => {
    expect(REDACTED_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers["x-api-key"]',
        'headers["x-api-key"]',
        'apiKey',
        'ANTHROPIC_API_KEY',
      ]),
    );
  });
});
