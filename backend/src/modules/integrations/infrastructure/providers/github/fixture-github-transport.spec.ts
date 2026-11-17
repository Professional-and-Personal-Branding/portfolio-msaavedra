import { FIXTURE_INVALID_TOKEN, FixtureGithubTransport } from './fixture-github-transport';

const TOKEN = 'token-de-prueba-no-real';
const OWNER = 'portafolio-ejemplo-ficticio';
const signal = (): AbortSignal => new AbortController().signal;

async function get(
  transport: FixtureGithubTransport,
  path: string,
  options: { etag?: string | null; token?: string } = {},
) {
  const result = await transport.get(path, {
    etag: options.etag ?? null,
    token: options.token ?? TOKEN,
    signal: signal(),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('FixtureGithubTransport (D15)', () => {
  it('responde el repo y los lenguajes de la cuenta ficticia con un ETag estable', async () => {
    const transport = new FixtureGithubTransport();
    const first = await get(transport, `/repos/${OWNER}/reservas-api`);
    const second = await get(transport, `/repos/${OWNER}/reservas-api`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      full_name: `${OWNER}/reservas-api`,
      stargazers_count: 12,
      language: 'Java',
    });
    expect(first.headers.etag).toMatch(/^"fixture-[0-9a-f]{12}"$/);
    expect(second.headers.etag).toBe(first.headers.etag);

    const languages = await get(transport, `/repos/${OWNER}/reservas-api/languages`);
    expect(languages.body).toMatchObject({ Java: 48200 });
  });

  it('responde 304 si If-None-Match coincide y 200 si no', async () => {
    const transport = new FixtureGithubTransport();
    const { headers } = await get(transport, `/repos/${OWNER}/reservas-api`);
    const notModified = await get(transport, `/repos/${OWNER}/reservas-api`, {
      etag: headers.etag,
    });
    expect(notModified).toMatchObject({ status: 304, body: undefined });
    const stale = await get(transport, `/repos/${OWNER}/reservas-api`, { etag: '"otro"' });
    expect(stale.status).toBe(200);
  });

  it('el owner y el repo no distinguen mayúsculas', async () => {
    const transport = new FixtureGithubTransport();
    const response = await get(transport, `/repos/Portafolio-Ejemplo-Ficticio/Reservas-API`);
    expect(response.status).toBe(200);
  });

  it('un repositorio sin carpeta es 404', async () => {
    const response = await get(new FixtureGithubTransport(), `/repos/${OWNER}/no-existe`);
    expect(response.status).toBe(404);
  });

  it('el secreto fixture-invalid-token responde 401 a todo', async () => {
    const transport = new FixtureGithubTransport();
    for (const path of [`/repos/${OWNER}/reservas-api`, `/repos/${OWNER}/reservas-api/languages`]) {
      const response = await get(transport, path, { token: FIXTURE_INVALID_TOKEN });
      expect(response.status).toBe(401);
    }
  });

  it('reproduce los casos de límite, permisos, privado y movido por nombre de repositorio', async () => {
    const transport = new FixtureGithubTransport();
    const limited = await get(transport, '/repos/cualquiera/rate-limited');
    expect(limited).toMatchObject({
      status: 403,
      headers: { 'x-ratelimit-remaining': '0' },
    });
    expect(Number(limited.headers['x-ratelimit-reset'])).toBeGreaterThan(Date.now() / 1000);

    const secondary = await get(transport, '/repos/cualquiera/secondary-limit');
    expect(secondary.status).toBe(403);
    expect(secondary.headers['retry-after']).toBeUndefined();
    expect(JSON.stringify(secondary.body)).toContain('secondary rate limit');

    expect((await get(transport, '/repos/cualquiera/forbidden')).status).toBe(403);
    expect((await get(transport, `/repos/${OWNER}/private-repo`)).body).toMatchObject({
      private: true,
    });
    expect((await get(transport, `/repos/${OWNER}/moved`)).body).toMatchObject({
      full_name: `${OWNER}/moved-v2`,
    });
  });

  it('una ruta que no es de repos es 404', async () => {
    expect((await get(new FixtureGithubTransport(), '/user')).status).toBe(404);
  });

  it('registra las peticiones sin el valor del token y nunca lo devuelve', async () => {
    const transport = new FixtureGithubTransport();
    const response = await get(transport, `/repos/${OWNER}/reservas-api`, {
      etag: '"x"',
      token: TOKEN,
    });
    expect(transport.requests).toEqual([
      {
        path: `/repos/${OWNER}/reservas-api`,
        hasAuthorization: true,
        authorizationScheme: 'Bearer',
        conditional: true,
      },
    ]);
    expect(JSON.stringify(transport.requests)).not.toContain(TOKEN);
    expect(JSON.stringify(response)).not.toContain(TOKEN);
  });

  it('mide las peticiones simultáneas', async () => {
    const transport = new FixtureGithubTransport();
    await Promise.all([
      get(transport, `/repos/${OWNER}/reservas-api`),
      get(transport, `/repos/${OWNER}/metricas-dashboard`),
    ]);
    expect(transport.maxConcurrent).toBe(2);
    transport.resetRecording();
    await get(transport, `/repos/${OWNER}/reservas-api`);
    expect(transport.maxConcurrent).toBe(1);
  });

  it('una señal abortada no responde datos', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await new FixtureGithubTransport().get(`/repos/${OWNER}/reservas-api`, {
      token: TOKEN,
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
  });
});
