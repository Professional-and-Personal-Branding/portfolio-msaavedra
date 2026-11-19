import { EXAMPLE_JWT_SECRET, expiresInToSeconds, validateEnv } from './env.validation';
import { EXAMPLE_INTEGRATIONS_KEY } from './integrations-keys';
import { shouldPublishDocs } from '../swagger';

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

describe('validateEnv — FRONTEND_URL es un origen (spec api-platform)', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'un-secreto-de-prueba-largo',
  };

  it.each([
    ['barra final', 'https://mjsaavedra.is-a.dev/'],
    ['ruta', 'https://ejemplo.dev/portafolio'],
    ['query', 'https://ejemplo.dev?x=1'],
    ['credenciales', 'https://usuario:clave@ejemplo.dev'],
    ['host en mayúsculas', 'https://Ejemplo.dev'],
  ])('rechaza %s nombrando la variable y sin imprimir el valor', (_caso, value) => {
    expect.assertions(2);
    try {
      validateEnv({ ...base, FRONTEND_URL: value });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/FRONTEND_URL: tiene que ser un origen/);
      expect(message).not.toContain(value);
    }
  });

  it('acepta un origen válido con puerto', () => {
    expect(validateEnv({ ...base, FRONTEND_URL: 'http://localhost:5173' }).FRONTEND_URL).toBe(
      'http://localhost:5173',
    );
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

describe('validateEnv — reglas de producción (spec api-platform)', () => {
  const strongSecret = 'x'.repeat(48);
  const production = {
    DATABASE_URL: 'postgresql://u:p@host:5432/db',
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://portafolio.example.com',
    JWT_SECRET: strongSecret,
    ANALYTICS_SALT: 'y'.repeat(44),
  };

  it('acepta una configuración de producción correcta', () => {
    expect(() => validateEnv(production)).not.toThrow();
  });

  it('rechaza el secreto de ejemplo del repositorio sin imprimir su valor', () => {
    expect.assertions(3);
    try {
      validateEnv({ ...production, JWT_SECRET: EXAMPLE_JWT_SECRET });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('JWT_SECRET');
      expect(message).toContain('ejemplo');
      expect(message).not.toContain(EXAMPLE_JWT_SECRET);
    }
  });

  it('rechaza un secreto corto en producción y no lo imprime', () => {
    const corto = 'x'.repeat(20);
    expect.assertions(2);
    try {
      validateEnv({ ...production, JWT_SECRET: corto });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/JWT_SECRET.*32/);
      expect(message).not.toContain(corto);
    }
  });

  it('rechaza ANALYTICS_SALT igual a JWT_SECRET', () => {
    expect(() => validateEnv({ ...production, ANALYTICS_SALT: strongSecret })).toThrow(
      /ANALYTICS_SALT/,
    );
  });

  it('exige ANALYTICS_SALT en producción y nombra la variable (sal ausente)', () => {
    const { ANALYTICS_SALT: _omitida, ...sinSal } = production;
    void _omitida;
    expect(() => validateEnv(sinSal)).toThrow(/ANALYTICS_SALT: obligatoria en producción/);
  });

  it('rechaza una ANALYTICS_SALT corta en producción sin imprimirla', () => {
    const corta = 'z'.repeat(20);
    expect.assertions(2);
    try {
      validateEnv({ ...production, ANALYTICS_SALT: corta });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/ANALYTICS_SALT.*32/);
      expect(message).not.toContain(corta);
    }
  });

  it('fuera de producción ANALYTICS_SALT sigue siendo opcional', () => {
    expect(() =>
      validateEnv({ ...production, NODE_ENV: 'development', ANALYTICS_SALT: undefined }),
    ).not.toThrow();
  });

  it('exige https en FRONTEND_URL', () => {
    expect(() =>
      validateEnv({ ...production, FRONTEND_URL: 'http://portafolio.example.com' }),
    ).toThrow(/FRONTEND_URL/);
  });

  it('en desarrollo esas reglas no aplican', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: production.DATABASE_URL,
        NODE_ENV: 'development',
        FRONTEND_URL: 'http://localhost:5173',
        JWT_SECRET: 'secreto-de-desarrollo',
      }),
    ).not.toThrow();
  });

  it('valida las variables nuevas de la Fase 6', () => {
    const env = validateEnv(production);
    expect(env.THROTTLE_TTL).toBe(60);
    expect(env.THROTTLE_LIMIT).toBe(120);
    expect(env.THROTTLE_LOGIN_LIMIT).toBe(5);

    expect(() => validateEnv({ ...production, LOG_LEVEL: 'chatty' })).toThrow(/LOG_LEVEL/);
    expect(() => validateEnv({ ...production, SESSION_COOKIE_SAMESITE: 'maybe' })).toThrow(
      /SESSION_COOKIE_SAMESITE/,
    );
    expect(() => validateEnv({ ...production, THROTTLE_LIMIT: '0' })).toThrow(/THROTTLE_LIMIT/);
  });
});

describe('shouldPublishDocs (spec api-platform)', () => {
  it('publica fuera de producción', () => {
    expect(shouldPublishDocs('development')).toBe(true);
    expect(shouldPublishDocs('test')).toBe(true);
  });

  it('no publica en producción salvo habilitación explícita', () => {
    expect(shouldPublishDocs('production')).toBe(false);
    expect(shouldPublishDocs('production', 'false')).toBe(false);
    expect(shouldPublishDocs('production', 'true')).toBe(true);
  });
});

// ── change add-integrations-foundation: reglas condicionales de las integraciones ──
describe('validateEnv — integraciones', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'un-secreto-de-prueba-largo',
  };
  const key = (seed: string, bytes = 32): string => Buffer.alloc(bytes, seed).toString('base64');
  const enabled = {
    ...base,
    INTEGRATIONS_ENABLED: 'fake',
    FAKE_PROVIDER_TOKEN: 'token-de-prueba-fake',
    INTEGRATIONS_KEYS: `k1:${key('a')}`,
    INTEGRATIONS_ACTIVE_KEY: 'k1',
  };

  /** Ejecuta la validación y devuelve el mensaje del error (o '' si fue válida). */
  function messageOf(config: Record<string, unknown>): string {
    try {
      validateEnv(config);
      return '';
    } catch (error) {
      return (error as Error).message;
    }
  }

  it('sin ninguna variable INTEGRATIONS_* arranca con todo apagado', () => {
    const env = validateEnv(base);
    expect(env.INTEGRATIONS_ENABLED).toBeUndefined();
    expect(env.INTEGRATIONS_SCHEDULER_ENABLED).toBeUndefined();
    expect(env.INTEGRATIONS_SYNC_CRON).toBe('0 10 * * *');
    expect(env.INTEGRATIONS_TICK_SECONDS).toBe(60);
    expect(env.INTEGRATIONS_JOB_TIMEOUT_MS).toBe(120000);
    expect(env.INTEGRATIONS_RUN_MAX_MS).toBe(300000);
  });

  it('FAKE_PROVIDER_TOKEN ausente es válido con INTEGRATIONS_ENABLED vacía y con fake en la lista (D11 enmendado)', () => {
    expect(messageOf({ ...base, INTEGRATIONS_ENABLED: '' })).toBe('');
    const { FAKE_PROVIDER_TOKEN: _omit, ...withoutToken } = enabled;
    void _omit;
    expect(messageOf(withoutToken)).toBe('');
  });

  it('con todo lo exigido, fake habilitado es válido', () => {
    expect(messageOf(enabled)).toBe('');
  });

  it('un id fuera del catálogo falla nombrando INTEGRATIONS_ENABLED sin imprimir el valor', () => {
    const message = messageOf({ ...base, INTEGRATIONS_ENABLED: 'gitlab-secreto' });
    expect(message).toMatch(/INTEGRATIONS_ENABLED/);
    expect(message).not.toContain('gitlab-secreto');
  });

  it('INTEGRATIONS_KEYS e INTEGRATIONS_ACTIVE_KEY se exigen solo con proveedores habilitados', () => {
    expect(messageOf({ ...enabled, INTEGRATIONS_KEYS: undefined })).toMatch(/INTEGRATIONS_KEYS/);
    expect(messageOf({ ...enabled, INTEGRATIONS_ACTIVE_KEY: undefined })).toMatch(
      /INTEGRATIONS_ACTIVE_KEY/,
    );
    expect(messageOf(base)).toBe('');
  });

  it('una clave de 16 bytes falla nombrando INTEGRATIONS_KEYS sin imprimirla', () => {
    const short = key('b', 16);
    const message = messageOf({ ...enabled, INTEGRATIONS_KEYS: `k1:${short}` });
    expect(message).toMatch(/INTEGRATIONS_KEYS/);
    expect(message).not.toContain(short);
  });

  it('un id de clave inválido o repetido falla nombrando INTEGRATIONS_KEYS', () => {
    const a = key('a');
    expect(messageOf({ ...enabled, INTEGRATIONS_KEYS: `K_1:${a}` })).toMatch(/INTEGRATIONS_KEYS/);
    expect(messageOf({ ...enabled, INTEGRATIONS_KEYS: `k1:${a},k1:${key('c')}` })).toMatch(
      /repetido/,
    );
  });

  it('INTEGRATIONS_ACTIVE_KEY debe estar en el keyring', () => {
    expect(messageOf({ ...enabled, INTEGRATIONS_ACTIVE_KEY: 'k9' })).toMatch(
      /INTEGRATIONS_ACTIVE_KEY/,
    );
  });

  it('fake está prohibido con NODE_ENV=production', () => {
    const production = {
      ...enabled,
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(48),
      FRONTEND_URL: 'https://portafolio.test',
    };
    expect(messageOf(production)).toMatch(/INTEGRATIONS_ENABLED/);
  });

  it('en producción, la clave de ejemplo y repetir JWT_SECRET fallan nombrando INTEGRATIONS_KEYS', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      JWT_SECRET: key('j'),
      ANALYTICS_SALT: key('s'),
      FRONTEND_URL: 'https://portafolio.test',
    };
    const example = messageOf({
      ...production,
      INTEGRATIONS_KEYS: `k1:${EXAMPLE_INTEGRATIONS_KEY}`,
    });
    expect(example).toMatch(/INTEGRATIONS_KEYS/);
    expect(example).not.toContain(EXAMPLE_INTEGRATIONS_KEY);
    expect(messageOf({ ...production, INTEGRATIONS_KEYS: `k1:${key('j')}` })).toMatch(
      /INTEGRATIONS_KEYS/,
    );
  });

  it('en producción, repetir ANALYTICS_SALT como clave del keyring falla nombrando INTEGRATIONS_KEYS', () => {
    const message = messageOf({
      ...base,
      NODE_ENV: 'production',
      JWT_SECRET: key('j'),
      ANALYTICS_SALT: key('s'),
      FRONTEND_URL: 'https://portafolio.test',
      INTEGRATIONS_KEYS: `k1:${key('s')}`,
      INTEGRATIONS_ACTIVE_KEY: 'k1',
    });
    expect(message).toMatch(/INTEGRATIONS_KEYS: no puede repetir ANALYTICS_SALT/);
    expect(message).not.toContain(key('s'));
  });

  it('un cron inválido falla nombrando INTEGRATIONS_SYNC_CRON sin imprimir el valor', () => {
    const message = messageOf({ ...base, INTEGRATIONS_SYNC_CRON: 'todos los días' });
    expect(message).toMatch(/INTEGRATIONS_SYNC_CRON/);
    expect(message).not.toContain('todos los días');
  });

  it('valida los rangos de tick, timeout y duración de la corrida', () => {
    expect(messageOf({ ...base, INTEGRATIONS_TICK_SECONDS: '5' })).toMatch(
      /INTEGRATIONS_TICK_SECONDS/,
    );
    expect(messageOf({ ...base, INTEGRATIONS_TICK_SECONDS: '3601' })).toMatch(
      /INTEGRATIONS_TICK_SECONDS/,
    );
    expect(messageOf({ ...base, INTEGRATIONS_JOB_TIMEOUT_MS: '4999' })).toMatch(
      /INTEGRATIONS_JOB_TIMEOUT_MS/,
    );
    expect(messageOf({ ...base, INTEGRATIONS_RUN_MAX_MS: '9999' })).toMatch(
      /INTEGRATIONS_RUN_MAX_MS/,
    );
    expect(messageOf({ ...base, INTEGRATIONS_SCHEDULER_ENABLED: 'si' })).toMatch(
      /INTEGRATIONS_SCHEDULER_ENABLED/,
    );
  });

  it('con claves en el keyring y sin INTEGRATIONS_ACTIVE_KEY falla nombrando la variable, aunque no haya proveedores (M1)', () => {
    expect(messageOf({ ...base, INTEGRATIONS_KEYS: `k1:${key('a')}` })).toMatch(
      /INTEGRATIONS_ACTIVE_KEY/,
    );
  });

  it('INTEGRATIONS_JOB_TIMEOUT_MS no puede superar INTEGRATIONS_RUN_MAX_MS (B2)', () => {
    const message = messageOf({
      ...base,
      INTEGRATIONS_JOB_TIMEOUT_MS: '60000',
      INTEGRATIONS_RUN_MAX_MS: '30000',
    });
    expect(message).toMatch(/INTEGRATIONS_JOB_TIMEOUT_MS/);
    expect(
      messageOf({
        ...base,
        INTEGRATIONS_JOB_TIMEOUT_MS: '30000',
        INTEGRATIONS_RUN_MAX_MS: '30000',
      }),
    ).toBe('');
  });
});

// add-ai-foundation: variables de la IA (spec api-platform).
describe('validateEnv — IA', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'un-secreto-de-prueba-largo',
  };
  const API_KEY = 'clave-de-prueba-que-jamas-debe-imprimirse';

  function messageOf(config: Record<string, unknown>): string {
    try {
      validateEnv(config);
      return '';
    } catch (error) {
      return (error as Error).message;
    }
  }

  it('sin ninguna variable AI_*: apagada, anthropic y tope de 10 USD', () => {
    const env = validateEnv(base);
    expect(env.AI_ENABLED).toBeUndefined();
    expect(env.AI_PROVIDER).toBe('anthropic');
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(10);
    expect(env.AI_REQUEST_TIMEOUT_MS).toBe(60000);
    expect(env.AI_MAX_CONCURRENCY).toBe(2);
    expect(env.AI_MAX_INPUT_TOKENS).toBe(50000);
  });

  it('encendida con anthropic y sin clave: falla nombrando ANTHROPIC_API_KEY', () => {
    expect(messageOf({ ...base, AI_ENABLED: 'true' })).toMatch(/ANTHROPIC_API_KEY/);
    expect(messageOf({ ...base, AI_ENABLED: 'true', ANTHROPIC_API_KEY: '' })).toMatch(
      /ANTHROPIC_API_KEY/,
    );
  });

  it('encendida con clave arranca; apagada no exige clave', () => {
    expect(messageOf({ ...base, AI_ENABLED: 'true', ANTHROPIC_API_KEY: API_KEY })).toBe('');
    expect(messageOf({ ...base, AI_ENABLED: 'false' })).toBe('');
  });

  it('con fake no pide la clave', () => {
    expect(messageOf({ ...base, AI_ENABLED: 'true', AI_PROVIDER: 'fake' })).toBe('');
  });

  it('fake en producción no arranca y el error nombra AI_PROVIDER', () => {
    const message = messageOf({
      ...base,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://portafolio.test',
      JWT_SECRET: 'x'.repeat(48),
      AI_PROVIDER: 'fake',
    });
    expect(message).toMatch(/AI_PROVIDER/);
  });

  it('presupuesto inválido (negativo, mayor a 1000, más de 2 decimales, no numérico)', () => {
    for (const value of ['-1', '1001', '10.123', 'abc']) {
      expect(messageOf({ ...base, AI_MONTHLY_BUDGET_USD: value })).toMatch(/AI_MONTHLY_BUDGET_USD/);
    }
    expect(validateEnv({ ...base, AI_MONTHLY_BUDGET_USD: '0' }).AI_MONTHLY_BUDGET_USD).toBe(0);
    expect(validateEnv({ ...base, AI_MONTHLY_BUDGET_USD: '12.5' }).AI_MONTHLY_BUDGET_USD).toBe(
      12.5,
    );
  });

  it('valida los rangos de timeout, concurrencia y entrada, también con la IA apagada', () => {
    expect(messageOf({ ...base, AI_REQUEST_TIMEOUT_MS: '4999' })).toMatch(/AI_REQUEST_TIMEOUT_MS/);
    expect(messageOf({ ...base, AI_REQUEST_TIMEOUT_MS: '120001' })).toMatch(
      /AI_REQUEST_TIMEOUT_MS/,
    );
    expect(messageOf({ ...base, AI_MAX_CONCURRENCY: '5' })).toMatch(/AI_MAX_CONCURRENCY/);
    expect(messageOf({ ...base, AI_MAX_CONCURRENCY: '0' })).toMatch(/AI_MAX_CONCURRENCY/);
    expect(messageOf({ ...base, AI_MAX_INPUT_TOKENS: '999' })).toMatch(/AI_MAX_INPUT_TOKENS/);
    expect(messageOf({ ...base, AI_MAX_INPUT_TOKENS: '100001' })).toMatch(/AI_MAX_INPUT_TOKENS/);
  });

  it('AI_ENABLED y AI_PROVIDER aceptan solo sus valores', () => {
    expect(messageOf({ ...base, AI_ENABLED: 'si' })).toMatch(/AI_ENABLED/);
    expect(messageOf({ ...base, AI_PROVIDER: 'openai' })).toMatch(/AI_PROVIDER/);
  });

  it('AI_FAKE_SCENARIO: solo con fake y con un valor conocido', () => {
    expect(messageOf({ ...base, AI_PROVIDER: 'fake', AI_FAKE_SCENARIO: 'slow' })).toBe('');
    expect(messageOf({ ...base, AI_PROVIDER: 'fake', AI_FAKE_SCENARIO: 'raro' })).toMatch(
      /AI_FAKE_SCENARIO/,
    );
    expect(messageOf({ ...base, AI_FAKE_SCENARIO: 'slow' })).toMatch(/AI_FAKE_SCENARIO/);
  });

  it('una clave con espacios se rechaza sin imprimirla', () => {
    const message = messageOf({ ...base, ANTHROPIC_API_KEY: 'con espacio' });
    expect(message).toMatch(/ANTHROPIC_API_KEY/);
    expect(message).not.toContain('con espacio');
  });

  it('el error de otra variable nunca imprime la clave', () => {
    const message = messageOf({
      DATABASE_URL: base.DATABASE_URL,
      JWT_SECRET: 'corto',
      AI_ENABLED: 'true',
      ANTHROPIC_API_KEY: API_KEY,
    });
    expect(message).toMatch(/JWT_SECRET/);
    expect(message).not.toContain(API_KEY);
  });
});
