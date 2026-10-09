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
