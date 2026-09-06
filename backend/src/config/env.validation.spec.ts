import { validateEnv } from './env.validation';

describe('validateEnv (spec api-platform — configuración fail-fast)', () => {
  const valid = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', PORT: '3300' };

  it('falla nombrando la variable cuando falta DATABASE_URL', () => {
    expect(() => validateEnv({ PORT: '3000' })).toThrow(/DATABASE_URL/);
  });

  it('aplica defaults: PORT 3000, NODE_ENV development, FRONTEND_URL local', () => {
    const env = validateEnv({ DATABASE_URL: valid.DATABASE_URL });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.FRONTEND_URL).toBe('http://localhost:5173');
  });

  it('convierte PORT a número y rechaza valores inválidos', () => {
    expect(validateEnv(valid).PORT).toBe(3300);
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rechaza NODE_ENV fuera del enum y FRONTEND_URL que no sea URL', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => validateEnv({ ...valid, FRONTEND_URL: 'no-es-url' })).toThrow(/FRONTEND_URL/);
  });
});
