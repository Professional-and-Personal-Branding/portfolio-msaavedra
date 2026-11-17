import * as fc from 'fast-check';
import {
  assertLlmSafe,
  isForbiddenKey,
  JsonValue,
  LlmPayload,
  redactFreeText,
} from './data-boundary';

const structured = (value: JsonValue): LlmPayload => ({ structured: value, freeText: {} });
const SECRET = 'secreto-de-la-config-1234567890';

describe('assertLlmSafe — claves prohibidas', () => {
  it.each([
    'email',
    'Email',
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'access_token',
    'secret',
    'apiKey',
    'api-key',
    'cookie',
    'ipHash',
    'salt',
    'hash',
    'sessionVersion',
    'userAgent',
    'referrer',
    'credential',
    'ciphertext',
    'phone',
    'telephone',
  ])('bloquea la clave %s, también anidada', (key) => {
    expect(isForbiddenKey(key)).toBe(true);
    const result = assertLlmSafe(structured({ a: [{ b: { [key]: 'x' } }] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('AI_FORBIDDEN_DATA');
      expect(result.error.message).toContain(key);
    }
  });

  it.each(['role', 'company', 'summary', 'highlights', 'technologies', 'inputHash', 'startDate'])(
    'deja pasar la clave legítima %s',
    (key) => {
      expect(isForbiddenKey(key)).toBe(false);
      expect(assertLlmSafe(structured({ [key]: 'valor' })).ok).toBe(true);
    },
  );

  it('también bloquea una clave prohibida en freeText', () => {
    const result = assertLlmSafe({ structured: null, freeText: { email: 'x' } });
    expect(result.ok).toBe(false);
  });
});

describe('assertLlmSafe — valores prohibidos en campos estructurados', () => {
  it.each([
    ['email', 'contacto: yo@ejemplo.test'],
    ['sk-ant-', 'sk-ant-api03-abcdefghijklmnop'],
    ['ghp_', `ghp_${'a'.repeat(36)}`],
    ['github_pat_', `github_pat_${'B'.repeat(30)}`],
    ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.firma_123'],
    ['IPv4', 'desde 192.168.1.20 ayer'],
    ['IPv6 completa', '2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
    ['IPv6 comprimida', 'fe80::1'],
    ['Bearer', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz'],
    ['secreto exacto', `texto ${SECRET} texto`],
  ])('bloquea %s', (_name, value) => {
    const result = assertLlmSafe(structured({ resumen: [value] }), [SECRET]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain(value);
  });

  it('un secreto corto de la configuración no bloquea todo (mínimo 8 caracteres)', () => {
    expect(assertLlmSafe(structured({ a: 'abc' }), ['abc']).ok).toBe(true);
  });

  it('no confunde versiones ni fechas con IPs', () => {
    expect(
      assertLlmSafe(structured({ a: 'Node 18.2.0 y .NET 8.0.100 — 2026-11-17 10:30:45' })).ok,
    ).toBe(true);
  });

  it('un valor numérico o nulo pasa', () => {
    expect(assertLlmSafe(structured({ years: 7, current: null, flag: true })).ok).toBe(true);
  });
});

describe('assertLlmSafe — texto libre', () => {
  it('redacta emails y teléfonos y cuenta cuántos', () => {
    const result = assertLlmSafe({
      structured: null,
      freeText: {
        vacante: 'Escribí a jobs@empresa.example o llamá al +591 71234567 (rrhh@empresa.example).',
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload.freeText.vacante).toBe(
        'Escribí a [email] o llamá al [teléfono] ([email]).',
      );
      expect(result.value.redactions).toEqual({ emails: 2, phones: 1 });
    }
  });

  it('no redacta fechas ISO ni años', () => {
    const redacted = redactFreeText('Desde 2026-01-15 hasta 2027; sueldo 4500 USD');
    expect(redacted.text).toBe('Desde 2026-01-15 hasta 2027; sueldo 4500 USD');
    expect(redacted.phones).toBe(0);
  });

  it('las credenciales siguen bloqueando en texto libre', () => {
    const result = assertLlmSafe({
      structured: null,
      freeText: { vacante: `usá la clave sk-ant-api03-${'z'.repeat(20)}` },
    });
    expect(result.ok).toBe(false);
  });

  it('un secreto exacto de la configuración bloquea en texto libre', () => {
    const result = assertLlmSafe({ structured: null, freeText: { vacante: `x ${SECRET}` } }, [
      SECRET,
    ]);
    expect(result.ok).toBe(false);
  });

  it('una IP en texto libre no bloquea (no se puede distinguir de una versión)', () => {
    expect(assertLlmSafe({ structured: null, freeText: { v: 'servidor 10.0.0.1' } }).ok).toBe(true);
  });
});

// Autocontrol: el detector realmente detecta (si estos fallaran, los demás tests no probarían nada).
describe('assertLlmSafe — autocontrol', () => {
  it('un payload limpio pasa y uno con email estructurado no', () => {
    expect(assertLlmSafe(structured({ role: 'Tech Lead' })).ok).toBe(true);
    expect(assertLlmSafe(structured({ role: 'a@b.co' })).ok).toBe(false);
  });
});

describe('assertLlmSafe — propiedad', () => {
  const leaf = fc.string({ maxLength: 12 }).filter((s) => !/[@]|sk-ant|gh|eyJ|\d{8}/i.test(s));
  const tree: fc.Arbitrary<JsonValue> = fc.letrec<{ node: JsonValue }>((tie) => ({
    node: fc.oneof(
      { depthSize: 'small', maxDepth: 3 },
      leaf,
      fc.array(tie('node'), { maxLength: 3 }),
      fc.dictionary(fc.constantFrom('a', 'b', 'role', 'items', 'x'), tie('node'), { maxKeys: 3 }),
    ),
  })).node;

  const forbiddenValues = [
    'persona@ejemplo.test',
    `sk-ant-api03-${'q'.repeat(24)}`,
    `ghp_${'a'.repeat(36)}`,
    '10.20.30.40',
    SECRET,
  ];

  it('un valor prohibido incrustado en cualquier estructura siempre bloquea', () => {
    fc.assert(
      fc.property(
        tree,
        fc.constantFrom(...forbiddenValues),
        fc.string({ maxLength: 5 }),
        (t, bad, pad) => {
          const result = assertLlmSafe(
            structured({ ok: t, nested: [{ deep: `${pad} ${bad} ${pad}` }] }),
            [SECRET],
          );
          expect(result.ok).toBe(false);
        },
      ),
    );
  });

  it('una clave prohibida incrustada en cualquier estructura siempre bloquea', () => {
    fc.assert(
      fc.property(tree, fc.constantFrom('email', 'password', 'accessToken', 'ipHash'), (t, key) => {
        expect(assertLlmSafe(structured({ ok: t, nested: [{ [key]: 'x' }] })).ok).toBe(false);
      }),
    );
  });

  it('en texto libre un email nunca sobrevive a la redacción', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (a, b) => {
        const result = assertLlmSafe({
          structured: null,
          freeText: { v: `${a} persona@ejemplo.test ${b}` },
        });
        if (result.ok)
          expect(result.value.payload.freeText.v).not.toContain('persona@ejemplo.test');
      }),
    );
  });
});
