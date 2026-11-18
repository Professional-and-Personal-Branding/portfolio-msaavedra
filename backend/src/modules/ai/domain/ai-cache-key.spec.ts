import { buildCacheKey, canonicalJson, CacheKeyParts, hashInput } from './ai-cache-key';

const base: CacheKeyParts = {
  task: 'ai.smoke',
  promptVersion: 1,
  promptHash: 'abc',
  model: 'claude-haiku-5-5',
  effort: 'low',
  thinking: 'off',
  maxTokens: 256,
  schemaVersion: 1,
  input: { a: 1, b: { c: [1, 2], d: 'x' } },
};

describe('canonicalJson', () => {
  it('ordena las claves y descarta undefined', () => {
    expect(canonicalJson({ b: 1, a: undefined, c: [{ z: 1, y: 2 }] })).toBe(
      '{"b":1,"c":[{"y":2,"z":1}]}',
    );
  });
});

describe('buildCacheKey', () => {
  it('es estable ante otro orden de claves', () => {
    const reordered: CacheKeyParts = { ...base, input: { b: { d: 'x', c: [1, 2] }, a: 1 } };
    expect(buildCacheKey(reordered)).toBe(buildCacheKey(base));
    expect(buildCacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['la versión del prompt', { promptVersion: 2 }],
    ['el hash del prompt', { promptHash: 'otro' }],
    ['el modelo', { model: 'claude-sonnet-5-5' }],
    ['el effort', { effort: 'high' }],
    ['el thinking', { thinking: 'adaptive' }],
    ['max_tokens', { maxTokens: 512 }],
    ['la versión del schema', { schemaVersion: 2 }],
    ['la entrada', { input: { a: 2 } }],
    ['la tarea', { task: 'otra' }],
  ])('cambia con %s', (_name, patch) => {
    expect(buildCacheKey({ ...base, ...patch })).not.toBe(buildCacheKey(base));
  });
});

describe('hashInput', () => {
  it('hashea la entrada canónica', () => {
    expect(hashInput({ b: 1, a: 2 })).toBe(hashInput({ a: 2, b: 1 }));
  });
});
