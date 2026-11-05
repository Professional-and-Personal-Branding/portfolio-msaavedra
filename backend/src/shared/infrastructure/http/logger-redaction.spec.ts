import pino from 'pino';
import { Writable } from 'stream';
import { buildLoggerOptions } from './logger.options';

/** Logger real con la configuración de la app, escribiendo a memoria. */
function captureLogger(): { logger: pino.Logger; lines: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const options = buildLoggerOptions('info', true).pinoHttp as pino.LoggerOptions;
  // `transport` no aplica cuando se escribe a un stream propio.
  const { transport: _transport, ...rest } = options;
  return { logger: pino(rest, stream), lines: () => chunks.join('') };
}

describe('Redacción real del logger (spec api-observability)', () => {
  it('de la petición solo escribe id, método y URL: las cabeceras nunca salen', () => {
    const { logger, lines } = captureLogger();

    logger.info({
      req: {
        id: 'req-1',
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          authorization: 'Bearer jwt.super.secreto',
          cookie: 'portfolio_session=jwt.super.secreto',
          'x-access-token': 'token-del-perfil',
        },
        body: { email: 'admin@example.com', password: 'Portfolio-2026!' },
      },
    });

    const output = lines();
    expect(output).not.toContain('jwt.super.secreto');
    expect(output).not.toContain('token-del-perfil');
    expect(output).not.toContain('Portfolio-2026!');
    expect(output).not.toContain('authorization');
    // Lo que sí queda es lo necesario para seguir la petición.
    expect(output).toContain('req-1');
    expect(output).toContain('/api/auth/login');
  });

  it('el token de la URL se redacta, la ruta se conserva', () => {
    const { logger, lines } = captureLogger();

    logger.info({ req: { id: 'r', method: 'GET', url: '/api/curated-profiles/x?token=secreto' } });

    const output = lines();
    expect(output).not.toContain('secreto');
    expect(output).toContain('token=[Redacted]');
    expect(output).toContain('/api/curated-profiles/x');
  });

  it('redacta contraseñas y tokens logueados fuera de la petición', () => {
    const { logger, lines } = captureLogger();

    logger.info({ password: 'otra-contraseña', accessToken: 'token-secreto' });

    const output = lines();
    expect(output).not.toContain('otra-contraseña');
    expect(output).not.toContain('token-secreto');
    expect(output).toContain('[Redacted]');
  });

  it('redacta currentPassword y newPassword, también dentro de req.body', () => {
    const { logger, lines } = captureLogger();

    logger.info({ currentPassword: 'la-actual-secreta', newPassword: 'la-nueva-secreta' });
    logger.info({
      req: {
        id: 'r',
        method: 'POST',
        url: '/api/auth/password',
        body: { currentPassword: 'la-actual-secreta', newPassword: 'la-nueva-secreta' },
      },
    });

    const output = lines();
    expect(output).not.toContain('la-actual-secreta');
    expect(output).not.toContain('la-nueva-secreta');
    expect(output).toContain('[Redacted]');
  });

  it('de la respuesta solo escribe el status: la cookie emitida nunca sale', () => {
    const { logger, lines } = captureLogger();

    logger.info({
      res: {
        statusCode: 200,
        headers: { 'set-cookie': 'portfolio_session=jwt.emitido; HttpOnly' },
      },
    });

    const output = lines();
    expect(output).not.toContain('jwt.emitido');
    expect(output).toContain('200');
  });

  it('emite JSON con nivel y marca de tiempo', () => {
    const { logger, lines } = captureLogger();
    logger.info('petición atendida');

    const entry = JSON.parse(lines().trim()) as { level: number; time: number; msg: string };
    expect(entry.msg).toBe('petición atendida');
    expect(typeof entry.level).toBe('number');
    expect(typeof entry.time).toBe('number');
  });

  it('respeta el nivel configurado', () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });
    const options = buildLoggerOptions('warn', true).pinoHttp as pino.LoggerOptions;
    const { transport: _transport, ...rest } = options;
    const logger = pino(rest, stream);

    logger.info('no debería salir');
    logger.warn('sí sale');

    expect(chunks.join('')).not.toContain('no debería salir');
    expect(chunks.join('')).toContain('sí sale');
  });
});
