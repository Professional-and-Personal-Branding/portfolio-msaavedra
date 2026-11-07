import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { GLOBAL_PREFIX } from './app.constants';
import { buildOpenApiDocument } from './swagger';

/**
 * `accentColor` está retirado del contrato (`retire-accent-color`, D8, spec
 * `admin-curated-profile-crud`): ningún schema lo declara. El documento se arma
 * con el mismo código que `openapi:export`: la app se crea sin `init()`, así
 * que no toca la base.
 */
describe('documento OpenAPI: accentColor retirado', () => {
  const previous = { ...process.env };
  let schemas: Record<string, { properties?: Record<string, unknown> }>;

  beforeAll(async () => {
    process.env.DATABASE_URL ||= 'postgresql://export:export@localhost:5432/export';
    process.env.JWT_SECRET ||= 'openapi-spec-placeholder-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix(GLOBAL_PREFIX);
    schemas = (buildOpenApiDocument(app).components?.schemas ?? {}) as typeof schemas;
  });

  afterAll(() => {
    process.env = previous;
  });

  it('el documento declara schemas (la comprobación no es vacía)', () => {
    expect(Object.keys(schemas).length).toBeGreaterThan(0);
    expect(schemas.CreateCuratedProfileDto).toBeDefined();
  });

  it('ningún schema de components.schemas tiene la propiedad accentColor', () => {
    const conAccentColor = Object.entries(schemas)
      .filter(([, schema]) => schema.properties && 'accentColor' in schema.properties)
      .map(([name]) => name);
    expect(conAccentColor).toEqual([]);
  });
});

/**
 * Exportación JSON Resume (`add-json-resume-export`, D10): las dos rutas están en el contrato, la
 * pública declara `locale`, `X-Access-Token` y `token` y nunca `via`/`src` (exportar no atribuye
 * visitas), y el cuerpo 200 es un objeto `application/json` que remite al schema externo.
 */
describe('documento OpenAPI: exportación JSON Resume', () => {
  const previous = { ...process.env };
  type Operation = {
    parameters?: { name: string; in: string }[];
    responses?: Record<
      string,
      { content?: Record<string, { schema?: { type?: string; externalDocs?: { url?: string } } }> }
    >;
  };
  let paths: Record<string, { get?: Operation }>;

  beforeAll(async () => {
    process.env.DATABASE_URL ||= 'postgresql://export:export@localhost:5432/export';
    process.env.JWT_SECRET ||= 'openapi-spec-placeholder-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix(GLOBAL_PREFIX);
    paths = buildOpenApiDocument(app).paths as typeof paths;
  });

  afterAll(() => {
    process.env = previous;
  });

  const names = (operation: Operation | undefined): string[] =>
    (operation?.parameters ?? []).map((parameter) => parameter.name);

  it('la ruta pública declara locale, X-Access-Token y token, y no via ni src', () => {
    const operation = paths['/api/curated-profiles/{slug}/resume.json']?.get;
    expect(operation).toBeDefined();
    expect(names(operation)).toEqual(
      expect.arrayContaining(['slug', 'locale', 'X-Access-Token', 'token']),
    );
    expect(names(operation)).not.toContain('via');
    expect(names(operation)).not.toContain('src');
    expect(Object.keys(operation?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '401', '404']),
    );
  });

  it('la ruta del panel declara locale y 200, 401 y 404', () => {
    const operation = paths['/api/admin/curated-profiles/{id}/resume.json']?.get;
    expect(operation).toBeDefined();
    expect(names(operation)).toEqual(expect.arrayContaining(['id', 'locale']));
    expect(Object.keys(operation?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '401', '404']),
    );
  });

  it('el cuerpo 200 es un objeto application/json con referencia al schema de JSON Resume', () => {
    for (const route of [
      '/api/curated-profiles/{slug}/resume.json',
      '/api/admin/curated-profiles/{id}/resume.json',
    ]) {
      const schema = paths[route]?.get?.responses?.['200']?.content?.['application/json']?.schema;
      expect(schema?.type).toBe('object');
      expect(schema?.externalDocs?.url).toContain('resume-schema/v1.0.0/schema.json');
    }
  });
});
