import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedListDto,
  LocalizedTextDto,
  toLocalizedList,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewExperienceProps } from '../../../domain/entities/experience.entity';
import { YEAR_MONTH_REGEX } from '../../../domain/services/validate-experience';

export class CreateExperienceDto {
  @ApiProperty({ example: 'ACME Corp' })
  @IsString()
  @IsNotEmpty()
  company!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  role!: LocalizedTextDto;

  @ApiProperty({ example: '2025-01', description: 'YYYY-MM' })
  @Matches(YEAR_MONTH_REGEX, { message: 'startDate must be YYYY-MM' })
  startDate!: string;

  @ApiPropertyOptional({
    example: '2025-12',
    description: 'YYYY-MM; omitir o null si es actual',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, { message: 'endDate must be YYYY-MM' })
  endDate?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @ApiProperty({ example: 'Santa Cruz, Bolivia · Remoto' })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  summary!: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedListDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedListDto)
  highlights?: LocalizedListDto;

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

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sector?: string[];

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

/** Edición parcial: todos los campos opcionales, mismas reglas. */
export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}

export function toNewExperienceProps(dto: CreateExperienceDto): NewExperienceProps {
  return {
    company: dto.company,
    role: toLocalizedText(dto.role),
    startDate: dto.startDate,
    endDate: dto.endDate ?? null,
    current: dto.current ?? false,
    location: dto.location,
    summary: toLocalizedText(dto.summary),
    highlights: dto.highlights ? toLocalizedList(dto.highlights) : { es: [] },
    technologies: dto.technologies ?? [],
    tags: dto.tags ?? [],
    sector: dto.sector ?? [],
    order: dto.order ?? 0,
    visible: dto.visible ?? true,
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar). */
type MutableChanges = { -readonly [K in keyof NewExperienceProps]?: NewExperienceProps[K] };

export function toExperienceChanges(dto: UpdateExperienceDto): Partial<NewExperienceProps> {
  const changes: MutableChanges = {};
  if (dto.company !== undefined) changes.company = dto.company;
  if (dto.role !== undefined) changes.role = toLocalizedText(dto.role);
  if (dto.startDate !== undefined) changes.startDate = dto.startDate;
  if (dto.endDate !== undefined) changes.endDate = dto.endDate;
  if (dto.current !== undefined) changes.current = dto.current;
  if (dto.location !== undefined) changes.location = dto.location;
  if (dto.summary !== undefined) changes.summary = toLocalizedText(dto.summary);
  if (dto.highlights !== undefined) changes.highlights = toLocalizedList(dto.highlights);
  if (dto.technologies !== undefined) changes.technologies = dto.technologies;
  if (dto.tags !== undefined) changes.tags = dto.tags;
  if (dto.sector !== undefined) changes.sector = dto.sector;
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.visible !== undefined) changes.visible = dto.visible;
  return changes;
}
