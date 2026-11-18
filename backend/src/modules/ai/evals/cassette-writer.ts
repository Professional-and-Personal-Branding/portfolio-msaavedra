import { redactSecretsUntruncated } from '../../../shared/domain/redact-secrets';
import { fail, ok, Result } from '../../../shared/domain/result';
import { Cassette } from '../infrastructure/cassette/cassette-llm.adapter';

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Dominios ficticios: los del ejemplo (`example.com`…) y los reservados `.test` y `.example`. */
export function isFictionalEmailDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return (
    ['example.com', 'example.org', 'example.net'].includes(d) ||
    d.endsWith('.test') ||
    d.endsWith('.example') ||
    d.endsWith('.example.com')
  );
}

function redactDeep(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') return redactSecretsUntruncated(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, secrets));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactDeep(item, secrets)]),
    );
  }
  return value;
}

/**
 * Serializa un cassette para escribirlo (D17): pasa cada string por `redactSecrets` con la clave
 * conocida y se NIEGA si después de redactar queda un `sk-ant-`, la clave exacta o un email que no
 * sea del dominio ficticio del ejemplo. Devuelve el texto o el motivo del rechazo (nunca el valor).
 */
export function prepareCassetteForWrite(
  cassette: Cassette,
  apiKey: string,
): Result<string, string> {
  const clean = redactDeep(cassette, apiKey === '' ? [] : [apiKey]);
  const text = `${JSON.stringify(clean, null, 2)}\n`;
  if (/sk-ant-/.test(text)) return fail('el cassette conserva algo con forma de clave (sk-ant-)');
  if (apiKey !== '' && text.includes(apiKey)) return fail('el cassette conserva la clave exacta');
  for (const match of text.matchAll(EMAIL)) {
    if (!isFictionalEmailDomain(match[1])) {
      return fail('el cassette contiene un email que no es del dominio ficticio del ejemplo');
    }
  }
  return ok(text);
}
