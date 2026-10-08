import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewEducationProps } from '../../../domain/entities/education.entity';
import { EDUCATION_DATE_REGEX } from '../../../domain/services/validate-education';

export class CreateEducationDto {
  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  degree!: LocalizedTextDto;

  @ApiProperty({ example: 'UAGRM School of Engineering' })
  @IsString()
  @IsNotEmpty()
  institution!: string;

  @ApiProperty({ example: '2024-02', description: 'YYYY-MM o YYYY' })
  @Matches(EDUCATION_DATE_REGEX, { message: 'startDate must be YYYY-MM or YYYY' })
  startDate!: string;

  @ApiPropertyOptional({
    example: '2021-04',
    description: 'YYYY-MM o YYYY; omitir o null si está en curso',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Matches(EDUCATION_DATE_REGEX, { message: 'endDate must be YYYY-MM or YYYY' })
  endDate?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  inProgress?: boolean;

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
export class UpdateEducationDto extends PartialType(CreateEducationDto) {}

export function toNewEducationProps(dto: CreateEducationDto): NewEducationProps {
  return {
    degree: toLocalizedText(dto.degree),
    institution: dto.institution,
    startDate: dto.startDate,
    endDate: dto.endDate ?? null,
    inProgress: dto.inProgress ?? false,
    order: dto.order ?? 0,
    visible: dto.visible ?? true,
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar). */
type MutableChanges = { -readonly [K in keyof NewEducationProps]?: NewEducationProps[K] };

export function toEducationChanges(dto: UpdateEducationDto): Partial<NewEducationProps> {
  const changes: MutableChanges = {};
  if (dto.degree !== undefined) changes.degree = toLocalizedText(dto.degree);
  if (dto.institution !== undefined) changes.institution = dto.institution;
  if (dto.startDate !== undefined) changes.startDate = dto.startDate;
  if (dto.endDate !== undefined) changes.endDate = dto.endDate;
  if (dto.inProgress !== undefined) changes.inProgress = dto.inProgress;
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.visible !== undefined) changes.visible = dto.visible;
  return changes;
}
