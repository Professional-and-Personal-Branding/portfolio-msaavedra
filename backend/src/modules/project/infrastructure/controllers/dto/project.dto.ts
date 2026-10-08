import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewProjectProps } from '../../../domain/entities/project.entity';

export class CreateProjectDto {
  @ApiProperty({ example: 'Portafolio Web Administrable' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  role!: LocalizedTextDto;

  @ApiProperty({ example: '2026' })
  @IsString()
  @IsNotEmpty()
  period!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  summary!: LocalizedTextDto;

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

  @ApiPropertyOptional({
    example: 'https://github.com/manu/portafolio',
    description: 'URL http(s) absoluta; null para quitarla',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string | null;

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
export class UpdateProjectDto extends PartialType(CreateProjectDto, {
  skipNullProperties: false,
}) {}

export function toNewProjectProps(dto: CreateProjectDto): NewProjectProps {
  return {
    name: dto.name,
    role: toLocalizedText(dto.role),
    period: dto.period,
    summary: toLocalizedText(dto.summary),
    technologies: dto.technologies ?? [],
    tags: dto.tags ?? [],
    url: dto.url ?? null,
    order: dto.order ?? 0,
    visible: dto.visible ?? true,
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar). */
type MutableChanges = { -readonly [K in keyof NewProjectProps]?: NewProjectProps[K] };

export function toProjectChanges(dto: UpdateProjectDto): Partial<NewProjectProps> {
  const changes: MutableChanges = {};
  if (dto.name !== undefined) changes.name = dto.name;
  if (dto.role !== undefined) changes.role = toLocalizedText(dto.role);
  if (dto.period !== undefined) changes.period = dto.period;
  if (dto.summary !== undefined) changes.summary = toLocalizedText(dto.summary);
  if (dto.technologies !== undefined) changes.technologies = dto.technologies;
  if (dto.tags !== undefined) changes.tags = dto.tags;
  if (dto.url !== undefined) changes.url = dto.url;
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.visible !== undefined) changes.visible = dto.visible;
  return changes;
}
