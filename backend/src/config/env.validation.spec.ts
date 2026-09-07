import { expiresInToSeconds, validateEnv } from './env.validation';

describe('validateEnv (spec api-platform — configuración fail-fast)', () => {
  const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    PORT: '3300',
    JWT_SECRET: 'un-secreto-de-prueba-largo',
  };

  it('falla nombrando la variable cuando falta DATABASE_URL', () => {
    expect(() => validateEnv({ PORT: '3000', JWT_SECRET: valid.JWT_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('falla nombrando JWT_SECRET cuando falta o es corta', () => {
    expect(() => validateEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('aplica defaults: PORT 3000, NODE_ENV development, FRONTEND_URL local, JWT_EXPIRES_IN 1d', () => {
    const env = validateEnv({ DATABASE_URL: valid.DATABASE_URL, JWT_SECRET: valid.JWT_SECRET });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.FRONTEND_URL).toBe('http://localhost:5173');
    expect(env.JWT_EXPIRES_IN).toBe('1d');
    expect(env.ANALYTICS_SALT).toBeUndefined();
  });

  it('convierte PORT a número y rechaza valores inválidos', () => {
    expect(validateEnv(valid).PORT).toBe(3300);
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rechaza NODE_ENV fuera del enum, FRONTEND_URL no URL y JWT_EXPIRES_IN inválido', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => validateEnv({ ...valid, FRONTEND_URL: 'no-es-url' })).toThrow(/FRONTEND_URL/);
    expect(() => validateEnv({ ...valid, JWT_EXPIRES_IN: 'un dia' })).toThrow(/JWT_EXPIRES_IN/);
    expect(validateEnv({ ...valid, JWT_EXPIRES_IN: '12h' }).JWT_EXPIRES_IN).toBe('12h');
  });
});

describe('expiresInToSeconds', () => {
  it('convierte unidades', () => {
    expect(expiresInToSeconds('90')).toBe(90);
    expect(expiresInToSeconds('30m')).toBe(1800);
    expect(expiresInToSeconds('12h')).toBe(43200);
    expect(expiresInToSeconds('1d')).toBe(86400);
  });
  it('rechaza formato inválido', () => {
    expect(() => expiresInToSeconds('x')).toThrow();
  });
});
