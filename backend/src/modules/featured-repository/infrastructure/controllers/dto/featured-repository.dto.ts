import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewFeaturedRepositoryProps } from '../../../domain/entities/featured-repository.entity';
import {
  GITHUB_REPOSITORY_URL_MESSAGE,
  GITHUB_REPOSITORY_URL_REGEX,
} from '../../../domain/services/parse-github-repository-url';
import {
  FEATURED_REPOSITORY_LANGUAGE_MAX,
  FEATURED_REPOSITORY_NAME_MAX,
} from '../../../domain/services/validate-featured-repository';

/** El DTO solo recorta los espacios de los bordes; no normaliza nada más (D2). */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFeaturedRepositoryDto {
  @ApiProperty({ example: 'reservas-api', maxLength: FEATURED_REPOSITORY_NAME_MAX })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FEATURED_REPOSITORY_NAME_MAX)
  name!: string;

  @ApiProperty({
    example: 'https://github.com/octo-org/reservas-api',
    description: 'Forma canónica https://github.com/<usuario>/<repositorio>',
  })
  @Transform(trim)
  @IsString()
  @Matches(GITHUB_REPOSITORY_URL_REGEX, { message: GITHUB_REPOSITORY_URL_MESSAGE })
  url!: string;

  @ApiPropertyOptional({
    example: 'Java',
    nullable: true,
    type: String,
    maxLength: FEATURED_REPOSITORY_LANGUAGE_MAX,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(FEATURED_REPOSITORY_LANGUAGE_MAX)
  language?: string | null;

  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  description!: LocalizedTextDto;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];

  @ApiPropertyOptional({
    type: [String],
    default: [],
    description: 'Tags para el filtrado de perfiles curados',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

/**
 * Edición parcial: todos los campos opcionales, mismas reglas. `null` en un
 * obligatorio se valida (400) en lugar de colarse hasta la base (500).
 */
export class UpdateFeaturedRepositoryDto extends PartialType(CreateFeaturedRepositoryDto, {
  skipNullProperties: false,
}) {}

/** Un `language` vacío equivale a no tener lenguaje. */
function normalizeLanguage(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : value;
}

export function toNewFeaturedRepositoryProps(
  dto: CreateFeaturedRepositoryDto,
): NewFeaturedRepositoryProps {
  return {
    name: dto.name,
    url: dto.url,
    language: normalizeLanguage(dto.language),
    description: toLocalizedText(dto.description),
    technologies: dto.technologies ?? [],
    tags: dto.tags ?? [],
    order: dto.order ?? 0,
    visible: dto.visible ?? true,
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar). */
type MutableChanges = {
  -readonly [K in keyof NewFeaturedRepositoryProps]?: NewFeaturedRepositoryProps[K];
};

export function toFeaturedRepositoryChanges(
  dto: UpdateFeaturedRepositoryDto,
): Partial<NewFeaturedRepositoryProps> {
  const changes: MutableChanges = {};
  if (dto.name !== undefined) changes.name = dto.name;
  if (dto.url !== undefined) changes.url = dto.url;
  if (dto.language !== undefined) changes.language = normalizeLanguage(dto.language);
  if (dto.description !== undefined) changes.description = toLocalizedText(dto.description);
  if (dto.technologies !== undefined) changes.technologies = dto.technologies;
  if (dto.tags !== undefined) changes.tags = dto.tags;
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.visible !== undefined) changes.visible = dto.visible;
  return changes;
}
