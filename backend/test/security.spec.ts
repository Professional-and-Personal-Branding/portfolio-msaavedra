/**
 * Blinda los bloqueantes del checklist de release que ya estaban cubiertos, para
 * que no se pierdan sin que nadie se entere (spec `api-platform`).
 * Es un test estático: lee el código fuente, no levanta la aplicación.
 */
import { getMetadataStorage, ValidationTypes } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../src');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

const controllers = walk(SRC).filter((file) => file.endsWith('.controller.ts'));

describe('Validación de entradas (bloqueante del release)', () => {
  it('hay controllers para revisar', () => {
    expect(controllers.length).toBeGreaterThan(5);
  });

  it('todo controller que recibe cuerpo aplica adminValidationPipe', () => {
    const sinPipe = controllers.filter((file) => {
      const source = fs.readFileSync(file, 'utf-8');
      const recibeCuerpo = source.includes('@Body()');
      return recibeCuerpo && !source.includes('adminValidationPipe');
    });

    expect(sinPipe.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('el pipe de administración usa whitelist y forbidNonWhitelisted', () => {
    const pipe = fs.readFileSync(
      path.join(SRC, 'shared/infrastructure/http/admin-validation.pipe.ts'),
      'utf-8',
    );
    expect(pipe).toContain('whitelist: true');
    expect(pipe).toContain('forbidNonWhitelisted: true');
  });
});

describe('Objetos anidados obligatorios (D-02)', () => {
  /**
   * Regresión: `class-validator` no valida un valor `undefined`, así que un
   * `@ValidateNested()` obligatorio sin `@IsDefined()` deja pasar un cuerpo que
   * omite el objeto y el mapper revienta con 500 en lugar de responder 400.
   * Se juzga sobre los metadatos que evalúa el pipe, no sobre el texto.
   */
  const validables = walk(SRC).filter((file) =>
    fs.readFileSync(file, 'utf-8').includes("from 'class-validator'"),
  );
  const clases = validables.flatMap((file) =>
    Object.values(jest.requireActual<Record<string, unknown>>(file)).filter(
      (value): value is new () => object => typeof value === 'function',
    ),
  );
  const storage = getMetadataStorage();

  it('hay clases validadas con objetos anidados para revisar', () => {
    const conAnidados = clases.filter((cls) =>
      storage
        .getTargetValidationMetadatas(cls, '', true, false)
        .some((m) => m.type === ValidationTypes.NESTED_VALIDATION),
    );
    expect(conAnidados.length).toBeGreaterThanOrEqual(3);
  });

  it('todo @ValidateNested() sin @IsOptional() lleva @IsDefined()', () => {
    const sinIsDefined = clases.flatMap((cls) => {
      const metadatas = storage.getTargetValidationMetadatas(cls, '', true, false);
      const tiene = (prop: string, type: string) =>
        metadatas.some((m) => m.propertyName === prop && m.type === type);
      return [
        ...new Set(
          metadatas
            .filter((m) => m.type === ValidationTypes.NESTED_VALIDATION)
            .map((m) => m.propertyName),
        ),
      ]
        .filter(
          (prop) =>
            !tiene(prop, ValidationTypes.CONDITIONAL_VALIDATION) &&
            !tiene(prop, ValidationTypes.IS_DEFINED),
        )
        .map((prop) => `${cls.name}.${prop}`);
    });

    expect(sinIsDefined).toEqual([]);
  });
});

describe('Secretos (bloqueante del release)', () => {
  it('ningún archivo de src contiene una cadena que parezca un secreto embebido', () => {
    const sospechosos = walk(SRC).filter((file) => {
      const source = fs.readFileSync(file, 'utf-8');
      // Cadenas largas en base64 o hex asignadas a algo que se llame secreto/token/password.
      return /(?:secret|token|password)\s*[:=]\s*['"][A-Za-z0-9+/=]{24,}['"]/i.test(source);
    });
    expect(sospechosos.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('el .env real no está versionado y el ejemplo no trae secretos reales', () => {
    const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf-8');
    expect(gitignore).toMatch(/^\.env$/m);

    const example = fs.readFileSync(path.resolve(__dirname, '../.env.example'), 'utf-8');
    expect(example).toContain('cambiar');
  });
});

describe('Orden del identificador de petición (api-observability)', () => {
  const main = fs.readFileSync(path.join(SRC, 'main.ts'), 'utf-8');

  /**
   * Regresión: `pino-http` genera su propio id si `req.id` no existe todavía.
   * Si el middleware corriera después del logger, el log llevaría un id y la
   * respuesta otro, y no se podrían cruzar al diagnosticar un incidente.
   */
  it('el middleware se registra antes que cualquier otro', () => {
    const requestId = main.indexOf('app.use(requestIdMiddleware)');
    const helmet = main.indexOf('app.use(buildHelmet');
    const cookies = main.indexOf('app.use(cookieParser())');

    expect(requestId).toBeGreaterThan(-1);
    expect(requestId).toBeLessThan(helmet);
    expect(requestId).toBeLessThan(cookies);
  });

  it('no se registra como middleware de módulo, que correría después del logger', () => {
    const appModule = fs.readFileSync(path.join(SRC, 'app.module.ts'), 'utf-8');
    expect(appModule).not.toContain('RequestIdMiddleware');
    expect(appModule).not.toContain('requestIdMiddleware');
  });

  it('el logger reutiliza el id de la petición en lugar de inventar otro', () => {
    const options = fs.readFileSync(
      path.join(SRC, 'shared/infrastructure/http/logger.options.ts'),
      'utf-8',
    );
    expect(options).toContain('genReqId');
    expect(options).toMatch(/existing\s*===?\s*'string'|typeof existing === 'string'/);
  });
});
