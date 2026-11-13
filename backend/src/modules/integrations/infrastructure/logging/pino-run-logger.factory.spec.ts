import pino from 'pino';
import { Writable } from 'stream';
import { PinoRunLoggerFactory } from './pino-run-logger.factory';

const SECRET = 'secreto-de-prueba-abc123';

function capture(): { factory: PinoRunLoggerFactory; lines: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _e, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  return {
    factory: new PinoRunLoggerFactory(pino({ level: 'debug' }, stream)),
    lines: () => chunks.join(''),
  };
}

describe('PinoRunLoggerFactory (B4)', () => {
  it('redacta el secreto del mensaje y de los textos de data, incluso anidados', () => {
    const { factory, lines } = capture();
    const log = factory.forRun({ syncRunId: 'r', jobId: 'j', provider: 'fake', secrets: [SECRET] });
    log.info(`falló con ${SECRET}`, {
      error: `Bearer ${SECRET}`,
      nested: { list: [`x ${SECRET}`] },
      n: 3,
    });
    const out = lines();
    expect(out).not.toContain(SECRET);
    expect(out).toContain('[Redacted]');
    expect(out).toContain('"n":3');
    expect(out).toContain('"syncRunId":"r"');
  });

  it('sin secretos deja el texto intacto', () => {
    const { factory, lines } = capture();
    factory.forRun({ syncRunId: 'r', jobId: 'j', provider: 'fake' }).warn('hola', { a: 'b' });
    expect(lines()).toContain('hola');
    expect(lines()).toContain('"a":"b"');
  });
});
