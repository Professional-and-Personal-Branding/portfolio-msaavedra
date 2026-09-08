import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Spec `api-contract-types`: `api.d.ts` debe corresponder al `openapi.json`
 * versionado. Si este test falla, ejecutar `npm run openapi:export` (backend)
 * y `npm run api:types` (frontend).
 */
describe('api.d.ts (tipos generados)', () => {
  const openapiPath = resolve(__dirname, '../../../../backend/openapi.json');
  const typesPath = resolve(__dirname, 'api.d.ts');

  it('coincide con el hash de backend/openapi.json', () => {
    const openapi = readFileSync(openapiPath, 'utf-8');
    const expected = createHash('sha256').update(openapi).digest('hex');
    const header = readFileSync(typesPath, 'utf-8').split('\n').slice(0, 5).join('\n');
    const match = /openapi-sha256: ([a-f0-9]{64})/.exec(header);

    expect(match?.[1], 'api.d.ts no tiene cabecera de hash').toBeDefined();
    expect(match?.[1], 'api.d.ts está desactualizado: correr npm run api:types').toBe(expected);
  });

  it('expone las rutas públicas que consume el frontend', () => {
    const types = readFileSync(typesPath, 'utf-8');
    for (const route of ['/api/curated-profiles', '/api/curated-profiles/{slug}', '/api/profile']) {
      expect(types).toContain(`"${route}"`);
    }
  });
});
