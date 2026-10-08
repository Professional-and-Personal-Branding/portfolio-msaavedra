/**
 * Blinda el defecto D-02 (`docs/MANUAL.md` § 6.1): un cuerpo al que le falta un
 * campo obligatorio debe fallar la validación y producir un 400, no colarse hasta
 * el mapper y reventar con un TypeError que el filtro traduce a 500.
 *
 * Es un test de comportamiento: corre class-validator sobre los DTO de entrada con
 * las mismas opciones que `adminValidationPipe`, sin levantar la aplicación.
 */
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCuratedProfileDto } from '../src/modules/curated-profile/infrastructure/controllers/dto/curated-profile.dto';
import { CreateExperienceDto } from '../src/modules/experience/infrastructure/controllers/dto/create-experience.dto';
import {
  CreateSkillCategoryDto,
  CreateSkillDto,
} from '../src/modules/skill/infrastructure/controllers/dto/skill.dto';
import { LoginDto } from '../src/modules/auth/infrastructure/controllers/dto/login.dto';

/** Mismas opciones de transformación que `adminValidationPipe`. */
function errorProps(dto: new () => object, body: Record<string, unknown>): string[] {
  const instance = plainToInstance(dto, body, { enableImplicitConversion: false });
  return validateSync(instance).map((error) => error.property);
}

/** Cada DTO de entrada con sus campos obligatorios y un cuerpo completo válido. */
const DTOS: Array<{
  nombre: string;
  dto: new () => object;
  obligatorios: string[];
  valido: Record<string, unknown>;
}> = [
  {
    nombre: 'CreateExperienceDto',
    dto: CreateExperienceDto,
    obligatorios: ['company', 'role', 'startDate', 'location', 'summary'],
    valido: {
      company: 'ACME Corp',
      role: { es: 'Dev', en: 'Dev' },
      startDate: '2025-01',
      location: 'Remoto',
      summary: { es: 'Resumen', en: 'Summary' },
    },
  },
  {
    nombre: 'CreateCuratedProfileDto',
    dto: CreateCuratedProfileDto,
    // `headline` es opcional desde add-profile-content-admin (D7): vacío = titular base.
    obligatorios: ['slug', 'title'],
    valido: {
      slug: 'qa-lead',
      title: { es: 'QA Lead' },
    },
  },
  {
    nombre: 'CreateSkillCategoryDto',
    dto: CreateSkillCategoryDto,
    obligatorios: ['name'],
    valido: { name: { es: 'Backend' } },
  },
  {
    nombre: 'CreateSkillDto',
    dto: CreateSkillDto,
    obligatorios: ['name'],
    valido: { name: 'Kafka Streams' },
  },
  {
    nombre: 'LoginDto',
    dto: LoginDto,
    obligatorios: ['email', 'password'],
    valido: { email: 'admin@example.com', password: 'una-clave-larga-de-prueba' },
  },
];

describe.each(DTOS)('$nombre (defecto D-02)', ({ dto, obligatorios, valido }) => {
  it('un cuerpo vacío reporta un error por cada campo obligatorio', () => {
    expect(errorProps(dto, {}).sort()).toEqual([...obligatorios].sort());
  });

  it.each(obligatorios)('un cuerpo sin "%s" reporta ese campo', (campo) => {
    const incompleto = { ...valido };
    delete incompleto[campo];
    expect(errorProps(dto, incompleto)).toContain(campo);
  });

  it.each(obligatorios)('un cuerpo con "%s" en null reporta ese campo', (campo) => {
    expect(errorProps(dto, { ...valido, [campo]: null })).toContain(campo);
  });

  it('el cuerpo completo válido no reporta errores (control)', () => {
    expect(errorProps(dto, valido)).toEqual([]);
  });
});
