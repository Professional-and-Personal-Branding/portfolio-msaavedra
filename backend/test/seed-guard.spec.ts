import {
  describeDatabaseTarget,
  evaluateContentLayer,
  evaluateEnvLayers,
  evaluateSeedGuard,
  formatGuardFailure,
} from '../scripts/lib/seed-guard';

/** Negativa en tres capas (change `add-learning-guide-and-example-data`, D6), sin base. */
describe('seed-guard', () => {
  const okEnv = { SEED_DISPOSABLE_DB: '1', NODE_ENV: 'development' };

  it('las tres capas en verde: base vacía', () => {
    expect(
      evaluateSeedGuard({ env: okEnv, existingProfileNames: [], incomingFullName: 'Ana Ejemplo' }),
    ).toEqual([]);
  });

  it('las tres capas en verde: recarga del mismo perfil', () => {
    expect(
      evaluateSeedGuard({
        env: okEnv,
        existingProfileNames: ['Ana Ejemplo'],
        incomingFullName: 'Ana Ejemplo',
      }),
    ).toEqual([]);
  });

  it('capa 1: falta SEED_DISPOSABLE_DB=1', () => {
    expect(evaluateEnvLayers({ NODE_ENV: 'development' }).map((x) => x.layer)).toEqual([1]);
    expect(evaluateEnvLayers({ SEED_DISPOSABLE_DB: '0' }).map((x) => x.layer)).toEqual([1]);
  });

  it('capa 2: NODE_ENV=production', () => {
    const f = evaluateEnvLayers({ SEED_DISPOSABLE_DB: '1', NODE_ENV: 'production' });
    expect(f.map((x) => x.layer)).toEqual([2]);
  });

  it('capa 3: la base tiene el perfil de otra persona', () => {
    const f = evaluateSeedGuard({
      env: okEnv,
      existingProfileNames: ['Otra Persona'],
      incomingFullName: 'Ana Ejemplo',
    });
    expect(f.map((x) => x.layer)).toEqual([3]);
  });

  it('capa 3: más de un perfil nunca es una recarga', () => {
    expect(evaluateContentLayer(['Ana Ejemplo', 'Ana Ejemplo'], 'Ana Ejemplo')?.layer).toBe(3);
  });

  it('sin consulta a la base no se evalúa la capa 3', () => {
    const f = evaluateSeedGuard({ env: {}, existingProfileNames: null, incomingFullName: 'x' });
    expect(f.map((x) => x.layer)).toEqual([1]);
  });

  it('el destino se muestra sin usuario ni contraseña', () => {
    const url = 'postgresql://portfolio:s3cr3t-pass@localhost:5434/portfolio?schema=public';
    expect(describeDatabaseTarget(url)).toBe('localhost:5434/portfolio');
    const message = formatGuardFailure(evaluateEnvLayers({}), describeDatabaseTarget(url));
    expect(message).not.toContain('s3cr3t-pass');
    expect(message).not.toContain('portfolio:');
    expect(message).toContain('localhost:5434/portfolio');
    expect(message).toContain('portfolio_example');
  });

  it('tolera una URL ausente o ilegible', () => {
    expect(describeDatabaseTarget(undefined)).toContain('sin definir');
    expect(describeDatabaseTarget('no es una url')).toContain('ilegible');
  });
});
