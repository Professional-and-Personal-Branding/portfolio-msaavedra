import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import {
  CURATED_VISIBILITIES,
  CuratedVisibility,
  NewCuratedProfileProps,
} from '../../../domain/entities/curated-profile.entity';
import { HEX_COLOR_REGEX, SLUG_REGEX } from '../../../domain/services/validate-curated-profile';
import { AccessToken } from '../../../domain/value-objects/access-token.vo';

export class CreateCuratedProfileDto {
  @ApiProperty({ example: 'qa-lead', description: 'kebab-case, único' })
  @Matches(SLUG_REGEX, { message: 'slug must be kebab-case' })
  slug!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto;

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  headline!: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedTextDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  description?: LocalizedTextDto | null;

  @ApiPropertyOptional({ type: LocalizedTextDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  roleType?: LocalizedTextDto | null;

  @ApiPropertyOptional({ nullable: true, example: '.NET' })
  @IsOptional()
  @IsString()
  techFocus?: string | null;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filterTags?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeIds?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[];

  @ApiPropertyOptional({ default: '#1A365D', example: '#5B2C87' })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'accentColor must be #RRGGBB' })
  accentColor?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Id de Theme existente' })
  @IsOptional()
  @IsString()
  themeId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  themeOverrides?: Record<string, unknown> | null;

  @ApiPropertyOptional({ default: 'classic' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  layout?: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionsOrder?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionsHidden?: string[];

  @ApiPropertyOptional({ enum: CURATED_VISIBILITIES, default: 'PUBLIC' })
  @IsOptional()
  @IsIn(CURATED_VISIBILITIES)
  visibility?: CuratedVisibility;

  @ApiPropertyOptional({ nullable: true, description: 'Obligatorio si visibility = PROTECTED' })
  @IsOptional()
  @IsString()
  accessToken?: string | null;
}

export class UpdateCuratedProfileDto extends PartialType(CreateCuratedProfileDto) {}

export function toNewCuratedProfileProps(dto: CreateCuratedProfileDto): NewCuratedProfileProps {
  return {
    slug: dto.slug,
    title: toLocalizedText(dto.title),
    headline: toLocalizedText(dto.headline),
    description: dto.description ? toLocalizedText(dto.description) : null,
    roleType: dto.roleType ? toLocalizedText(dto.roleType) : null,
    techFocus: dto.techFocus ?? null,
    filterTags: dto.filterTags ?? [],
    includeIds: dto.includeIds ?? [],
    excludeIds: dto.excludeIds ?? [],
    accentColor: dto.accentColor ?? '#1A365D',
    themeId: dto.themeId ?? null,
    themeOverrides: dto.themeOverrides ?? null,
    layout: dto.layout ?? 'classic',
    sectionsOrder: dto.sectionsOrder ?? [],
    sectionsHidden: dto.sectionsHidden ?? [],
    visibility: dto.visibility ?? 'PUBLIC',
    accessToken: AccessToken.create(dto.accessToken),
  };
}

type MutableChanges = {
  -readonly [K in keyof NewCuratedProfileProps]?: NewCuratedProfileProps[K];
};

/** Solo las claves presentes en el PATCH (undefined = no tocar; null = limpiar donde aplica). */
export function toCuratedProfileChanges(
  dto: UpdateCuratedProfileDto,
): Partial<NewCuratedProfileProps> {
  const c: MutableChanges = {};
  if (dto.slug !== undefined) c.slug = dto.slug;
  if (dto.title !== undefined) c.title = toLocalizedText(dto.title);
  if (dto.headline !== undefined) c.headline = toLocalizedText(dto.headline);
  if (dto.description !== undefined)
    c.description = dto.description ? toLocalizedText(dto.description) : null;
  if (dto.roleType !== undefined) c.roleType = dto.roleType ? toLocalizedText(dto.roleType) : null;
  if (dto.techFocus !== undefined) c.techFocus = dto.techFocus;
  if (dto.filterTags !== undefined) c.filterTags = dto.filterTags;
  if (dto.includeIds !== undefined) c.includeIds = dto.includeIds;
  if (dto.excludeIds !== undefined) c.excludeIds = dto.excludeIds;
  if (dto.accentColor !== undefined) c.accentColor = dto.accentColor;
  if (dto.themeId !== undefined) c.themeId = dto.themeId;
  if (dto.themeOverrides !== undefined) c.themeOverrides = dto.themeOverrides;
  if (dto.layout !== undefined) c.layout = dto.layout;
  if (dto.sectionsOrder !== undefined) c.sectionsOrder = dto.sectionsOrder;
  if (dto.sectionsHidden !== undefined) c.sectionsHidden = dto.sectionsHidden;
  if (dto.visibility !== undefined) c.visibility = dto.visibility;
  if (dto.accessToken !== undefined) c.accessToken = AccessToken.create(dto.accessToken);
  return c;
}
