import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { GLOBAL_PREFIX } from './app.constants';
import { buildOpenApiDocument } from './swagger';

/**
 * `accentColor` está obsoleto en el contrato (D9 de `polish-builder-and-edge`,
 * spec `admin-curated-profile-crud`). El documento se arma con el mismo código
 * que `openapi:export`: la app se crea sin `init()`, así que no toca la base.
 */
describe('documento OpenAPI: accentColor obsoleto', () => {
  const previous = { ...process.env };
  let schemas: Record<
    string,
    { properties?: Record<string, { deprecated?: boolean; description?: string }> }
  >;

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

  it.each([
    'CreateCuratedProfileDto',
    'UpdateCuratedProfileDto',
    'PreviewCuratedProfileDto',
    'AdminCuratedProfileResponse',
    'CuratedProfileSummaryResponse',
    'CuratedProfileResponse',
    'PreviewCuratedProfileResponse',
  ])('%s lo marca deprecated con su descripción', (name) => {
    const property = schemas[name]?.properties?.accentColor;
    expect(property?.deprecated).toBe(true);
    expect(property?.description).toMatch(/Obsoleto/);
  });
});
