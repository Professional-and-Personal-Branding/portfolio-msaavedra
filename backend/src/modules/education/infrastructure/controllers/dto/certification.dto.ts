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
import { NewCertificationProps } from '../../../domain/entities/certification.entity';
import { YEAR_REGEX } from '../../../domain/services/validate-certification';

export class CreateCertificationDto {
  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name!: LocalizedTextDto;

  @ApiProperty({ example: 'CertifPro, Sunrise Florida, EEUU' })
  @IsString()
  @IsNotEmpty()
  issuer!: string;

  @ApiPropertyOptional({
    example: '2021',
    description: 'YYYY; omitir o null si no se conoce',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Matches(YEAR_REGEX, { message: 'year must be YYYY' })
  year?: string | null;

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
export class UpdateCertificationDto extends PartialType(CreateCertificationDto) {}

export function toNewCertificationProps(dto: CreateCertificationDto): NewCertificationProps {
  return {
    name: toLocalizedText(dto.name),
    issuer: dto.issuer,
    year: dto.year ?? null,
    order: dto.order ?? 0,
    visible: dto.visible ?? true,
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar). */
type MutableChanges = { -readonly [K in keyof NewCertificationProps]?: NewCertificationProps[K] };

export function toCertificationChanges(
  dto: UpdateCertificationDto,
): Partial<NewCertificationProps> {
  const changes: MutableChanges = {};
  if (dto.name !== undefined) changes.name = toLocalizedText(dto.name);
  if (dto.issuer !== undefined) changes.issuer = dto.issuer;
  if (dto.year !== undefined) changes.year = dto.year;
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.visible !== undefined) changes.visible = dto.visible;
  return changes;
}
