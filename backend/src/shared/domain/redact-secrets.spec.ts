import { MAX_REDACTED_LENGTH, redactSecrets, redactSecretsUntruncated } from './redact-secrets';

describe('redactSecrets', () => {
  it('reemplaza el valor exacto de un secreto conocido', () => {
    expect(redactSecrets('falló con abc123XYZ en la llamada', ['abc123XYZ'])).toBe(
      'falló con [Redacted] en la llamada',
    );
  });

  it('reemplaza también la forma en base64 del secreto', () => {
    const secret = 'super-secreto-1';
    const b64 = Buffer.from(secret).toString('base64');
    const out = redactSecrets(`Authorization: Basic ${b64}`, [secret]);
    expect(out).not.toContain(b64);
    expect(out).toContain('[Redacted]');
  });

  it('reemplaza todas las apariciones y escapa los caracteres de regex del secreto', () => {
    expect(redactSecrets('a.b*c y a.b*c', ['a.b*c'])).toBe('[Redacted] y [Redacted]');
  });

  it('ignora secretos vacíos', () => {
    expect(redactSecrets('texto', [''])).toBe('texto');
  });

  it.each([
    ['ghp_', 'ghp_' + 'a'.repeat(36)],
    ['gho_', 'gho_' + 'B'.repeat(36)],
    ['github_pat_', 'github_pat_' + '1'.repeat(40)],
    ['sk-ant-', 'sk-ant-api03-' + 'x'.repeat(30)],
  ])('detecta un token %s sin conocerlo de antemano', (_name, token) => {
    const out = redactSecrets(`error con ${token} al llamar`);
    expect(out).not.toContain(token);
    expect(out).toContain('[Redacted]');
  });

  it('reemplaza el valor de Bearer', () => {
    expect(redactSecrets('Authorization: Bearer abc.def-ghi')).toBe(
      'Authorization: Bearer [Redacted]',
    );
  });

  it('token=x&y=1 conserva y=1', () => {
    expect(redactSecrets('GET /x?token=secreto&y=1')).toBe('GET /x?token=[Redacted]&y=1');
  });

  it('deja intacto un texto sin secretos', () => {
    expect(redactSecrets('HTTP 503: servicio no disponible')).toBe(
      'HTTP 503: servicio no disponible',
    );
  });

  it('recorta a 500 caracteres', () => {
    const out = redactSecrets('x'.repeat(MAX_REDACTED_LENGTH + 1));
    expect(out).toHaveLength(500);
  });

  it('redactSecretsUntruncated redacta igual pero no recorta (cassettes de IA)', () => {
    const long = `${'y'.repeat(800)} sk-ant-api03-${'q'.repeat(30)}`;
    const out = redactSecretsUntruncated(long);
    expect(out).toHaveLength(800 + 1 + '[Redacted]'.length);
    expect(out).not.toContain('sk-ant-');
    expect(redactSecrets(long)).toHaveLength(500);
  });
});
