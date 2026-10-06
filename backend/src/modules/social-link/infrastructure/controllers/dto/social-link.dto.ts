import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewSocialLinkProps } from '../../../domain/entities/social-link.entity';

export class CreateSocialLinkDto {
  @ApiProperty({ example: 'github', description: 'Minúsculas, dígitos y guiones' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  platform!: string;

  @ApiProperty({ example: 'manuXD270516' })
  @IsString()
  @IsNotEmpty()
  handle!: string;

  @ApiProperty({ example: 'https://github.com/manuXD270516', description: 'URL http(s) absoluta' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  label!: LocalizedTextDto;

  @ApiPropertyOptional({
    type: LocalizedTextDto,
    nullable: true,
    description: 'null para quitarla',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  description?: LocalizedTextDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: { repos: 67, achievements: ['Pull Shark'] },
    description: 'Objeto JSON libre; null para quitarlo. Arrays y primitivos → 400',
  })
  @IsOptional()
  // `IsObject` de class-validator ya rechaza arrays (y primitivos).
  @IsObject()
  stats?: Record<string, unknown> | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

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
 * Edición parcial: todos los campos opcionales, mismas reglas. `null` se valida
 * (no se salta) para que `{ label: null }` o `{ handle: null }` respondan 400;
 * `description` y `stats` siguen admitiendo null por su `@IsOptional()` propio.
 */
export class UpdateSocialLinkDto extends PartialType(CreateSocialLinkDto, {
  skipNullProperties: false,
}) {}

export function toNewSocialLinkProps(dto: CreateSocialLinkDto): NewSocialLinkProps {
  return {
    platform: dto.platform,
    handle: dto.handle,
    url: dto.url,
    label: toLocalizedText(dto.label),
    description: dto.description ? toLocalizedText(dto.description) : null,
    stats: dto.stats ?? null,
    featured: dto.featured ?? false,
    order: dto.order ?? 0,
    visible: dto.visible ?? true,
  };
}

/** Solo las claves presentes en el PATCH (undefined = no tocar). */
type MutableChanges = { -readonly [K in keyof NewSocialLinkProps]?: NewSocialLinkProps[K] };

export function toSocialLinkChanges(dto: UpdateSocialLinkDto): Partial<NewSocialLinkProps> {
  const changes: MutableChanges = {};
  if (dto.platform !== undefined) changes.platform = dto.platform;
  if (dto.handle !== undefined) changes.handle = dto.handle;
  if (dto.url !== undefined) changes.url = dto.url;
  if (dto.label !== undefined) changes.label = toLocalizedText(dto.label);
  if (dto.description !== undefined) {
    changes.description = dto.description === null ? null : toLocalizedText(dto.description);
  }
  if (dto.stats !== undefined) changes.stats = dto.stats;
  if (dto.featured !== undefined) changes.featured = dto.featured;
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.visible !== undefined) changes.visible = dto.visible;
  return changes;
}
