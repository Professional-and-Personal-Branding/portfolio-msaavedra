import { checkUrlPolicy, MAX_URL_LENGTH } from './check-url-policy';
import { canonicalizeUrl } from './canonicalize-url';

describe('checkUrlPolicy (D7)', () => {
  const rejected: Array<[string, string]> = [
    ['http sin TLS', 'http://careers.acme-ejemplo.com/job/1'],
    ['otro esquema', 'ftp://careers.acme-ejemplo.com/job/1'],
    ['puerto interno 5432', 'https://careers.acme-ejemplo.com:5432/job/1'],
    ['puerto 8443', 'https://careers.acme-ejemplo.com:8443/job/1'],
    ['usuario y contraseña', 'https://user:pass@careers.acme-ejemplo.com/job/1'],
    ['solo usuario', 'https://user@careers.acme-ejemplo.com/job/1'],
    ['IPv4 literal', 'https://127.0.0.1/'],
    ['IPv4 pública literal', 'https://93.184.216.34/'],
    ['IPv4 decimal', 'https://2130706433/'],
    ['IPv4 hexadecimal corta', 'https://0x7f.1/'],
    ['IPv4 octal', 'https://0177.0.0.1/'],
    ['IPv4 con punto final', 'https://127.0.0.1./'],
    ['IPv6 loopback', 'https://[::1]/'],
    ['IPv4 mapeada en IPv6', 'https://[::ffff:127.0.0.1]/'],
    ['IPv6 de metadata mapeada', 'https://[::ffff:169.254.169.254]/'],
    ['localhost', 'https://localhost/'],
    ['localhost con punto final', 'https://localhost./'],
    ['subdominio de localhost', 'https://x.localhost/'],
    ['red privada de Railway', 'https://api.railway.internal/'],
    ['con punto final en .internal', 'https://api.railway.internal./'],
    ['.local', 'https://nas.local/'],
    ['.lan', 'https://router.lan/'],
    ['.home.arpa', 'https://impresora.home.arpa/'],
    ['sin punto', 'https://intranet/'],
    ['sin punto y con punto final', 'https://intranet./'],
    ['.test', 'https://acme.test/'],
    ['.example', 'https://acme.example/'],
    ['.invalid', 'https://acme.invalid/'],
    ['no es una URL', 'esto no es una url'],
    ['vacía', ''],
    [
      '2049 caracteres',
      `https://careers.acme-ejemplo.com/${'a'.repeat(MAX_URL_LENGTH - 30)}/${'b'.repeat(40)}`,
    ],
  ];

  it.each(rejected)('rechaza %s', (_name, raw) => {
    const result = checkUrlPolicy(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('url-not-allowed');
      expect(result.error.message).not.toMatch(/127\.0\.0\.1|169\.254/);
    }
  });

  it('el rechazo de http dice cómo corregirlo, literal', () => {
    const result = checkUrlPolicy('http://careers.acme-ejemplo.com/job/1');
    expect(!result.ok && result.error.message).toBe('Usá una URL que empiece con https://');
  });

  it('una URL de exactamente 2048 caracteres pasa', () => {
    const base = 'https://careers.acme-ejemplo.com/';
    const raw = base + 'a'.repeat(MAX_URL_LENGTH - base.length);
    expect(raw).toHaveLength(MAX_URL_LENGTH);
    expect(checkUrlPolicy(raw).ok).toBe(true);
  });

  it('una URL pública https pasa y pierde el fragmento', () => {
    const result = checkUrlPolicy('  https://careers.acme-ejemplo.com/job/1?x=1#apply ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.href).toBe('https://careers.acme-ejemplo.com/job/1?x=1');
  });

  it('acepta el puerto 443 explícito', () => {
    expect(checkUrlPolicy('https://careers.acme-ejemplo.com:443/job/1').ok).toBe(true);
  });

  it('acepta mayúsculas y un punto final en un nombre público', () => {
    expect(checkUrlPolicy('https://Careers.Acme-Ejemplo.com./job/1').ok).toBe(true);
  });
});

describe('canonicalizeUrl (D14)', () => {
  it('quita el fragmento y los parámetros de seguimiento', () => {
    expect(
      canonicalizeUrl(
        'https://careers.acme-ejemplo.com/job/1?utm_source=x&utm_medium=y&gh_src=a&lever-source=b&ref=c&source=d#apply',
      ),
    ).toBe('https://careers.acme-ejemplo.com/job/1');
  });

  it('ordena el resto de la query', () => {
    expect(canonicalizeUrl('https://careers.acme-ejemplo.com/job?b=2&a=1&utm_term=z')).toBe(
      'https://careers.acme-ejemplo.com/job?a=1&b=2',
    );
  });

  it('baja el host a minúsculas y quita el punto final', () => {
    expect(canonicalizeUrl('https://Careers.Acme-Ejemplo.com./job/1')).toBe(
      'https://careers.acme-ejemplo.com/job/1',
    );
  });

  it('la misma vacante con y sin seguimiento da la misma canónica', () => {
    expect(canonicalizeUrl('https://x.acme-ejemplo.com/j/1?utm_source=a#apply')).toBe(
      canonicalizeUrl('https://x.acme-ejemplo.com/j/1'),
    );
  });

  it('conserva los parámetros que identifican la vacante', () => {
    expect(canonicalizeUrl('https://x.acme-ejemplo.com/jobs?gh_jid=123')).toBe(
      'https://x.acme-ejemplo.com/jobs?gh_jid=123',
    );
  });
});
