import { PrismaService } from '../../shared/infrastructure/persistence/prisma.service';
import { HealthService } from './health.service';

function build(queryRaw: jest.Mock) {
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  const service = new HealthService(prisma);
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  return service;
}

describe('HealthService', () => {
  it('con la base accesible informa ok y up', async () => {
    const service = build(jest.fn().mockResolvedValue([{ '?column?': 1 }]));
    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.checks.database.status).toBe('up');
    expect(report.checks.database.responseTime).toBeGreaterThanOrEqual(0);
    expect(report.uptime).toBeGreaterThanOrEqual(0);
  });

  it('con la base caída informa error y down', async () => {
    const service = build(jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));
    const report = await service.check();

    expect(report.status).toBe('error');
    expect(report.checks.database.status).toBe('down');
  });

  it('nunca devuelve el mensaje del driver ni la cadena de conexión', async () => {
    const service = build(
      jest
        .fn()
        .mockRejectedValue(
          new Error('Can not reach database server at postgresql://user:pass@host:5432/db'),
        ),
    );
    const serialized = JSON.stringify(await service.check());

    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain('pass');
    expect(serialized).not.toContain('ECONNREFUSED');
  });

  it('registra el detalle en el log', async () => {
    const service = build(jest.fn().mockRejectedValue(new Error('detalle del driver')));
    const warn = jest.spyOn(service['logger'], 'warn');

    await service.check();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('detalle del driver'));
  });

  it('una base que no responde se considera caída sin colgar la sonda', async () => {
    // Nunca resuelve: debe ganar el timeout interno.
    const service = build(jest.fn().mockReturnValue(new Promise(() => undefined)));
    jest.useFakeTimers();

    const pending = service.check();
    await jest.advanceTimersByTimeAsync(2500);
    const report = await pending;

    jest.useRealTimers();
    expect(report.status).toBe('error');
    expect(report.checks.database.status).toBe('down');
  });
});
