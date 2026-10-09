import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ACCENT_COLOR_DEPRECATED } from '../docs/accent-color-deprecated';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
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
import { SECTION_IDS, SectionId } from '../../../domain/services/resolve-sections';
import { AccessToken } from '../../../domain/value-objects/access-token.vo';
import { IsSectionIdList } from './is-section-id-list.validator';

export class CreateCuratedProfileDto {
  @ApiProperty({ example: 'qa-lead', description: 'kebab-case, único' })
  @Matches(SLUG_REGEX, { message: 'slug must be kebab-case' })
  slug!: string;

  @ApiProperty({ type: LocalizedTextDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto;

  @ApiPropertyOptional({
    type: LocalizedTextDto,
    description:
      'Titular propio del perfil. Omitido o vacío, el hero muestra el titular del perfil base ' +
      '(add-profile-content-admin, D7).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  headline?: LocalizedTextDto;

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

  @ApiPropertyOptional({ nullable: true, type: String, example: '.NET' })
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

  @ApiPropertyOptional({
    default: '#1A365D',
    example: '#5B2C87',
    deprecated: true,
    description: ACCENT_COLOR_DEPRECATED,
  })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'accentColor must be #RRGGBB' })
  accentColor?: string;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Id de Theme existente' })
  @IsOptional()
  @IsString()
  themeId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  themeOverrides?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    default: true,
    description:
      'Se enumera en el listado público, el menú y el sitemap. No afecta el acceso por slug. ' +
      'El archivado no se escribe acá: tiene sus propios endpoints.',
  })
  @IsOptional()
  @IsBoolean()
  listed?: boolean;

  @ApiPropertyOptional({ default: 'classic' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  layout?: string;

  /** Orden de las secciones; vacío = catálogo completo en orden canónico. */
  @ApiPropertyOptional({
    enum: SECTION_IDS,
    enumName: 'SectionId',
    isArray: true,
    default: [],
  })
  @IsOptional()
  @IsSectionIdList()
  sectionsOrder?: SectionId[];

  @ApiPropertyOptional({
    enum: SECTION_IDS,
    enumName: 'SectionId',
    isArray: true,
    default: [],
  })
  @IsOptional()
  @IsSectionIdList()
  sectionsHidden?: SectionId[];

  @ApiPropertyOptional({ enum: CURATED_VISIBILITIES, default: 'PUBLIC' })
  @IsOptional()
  @IsIn(CURATED_VISIBILITIES)
  visibility?: CuratedVisibility;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Obligatorio si visibility = PROTECTED',
  })
  @IsOptional()
  @IsString()
  accessToken?: string | null;
}

export class UpdateCuratedProfileDto extends PartialType(CreateCuratedProfileDto) {}

/**
 * Borrador para el preview del backoffice: todo opcional, porque un perfil en
 * construcción todavía no tiene slug ni textos (spec `admin-curated-profile-preview`).
 */
export class PreviewCuratedProfileDto extends PartialType(CreateCuratedProfileDto) {}

/**
 * Cuerpo de duplicar: vacío a propósito. Con `forbidNonWhitelisted`, cualquier
 * campo —un `slug`, por ejemplo— da 400: el slug se deriva y renombrar es aparte.
 */
export class DuplicateCuratedProfileDto {}

export function toNewCuratedProfileProps(dto: CreateCuratedProfileDto): NewCuratedProfileProps {
  return {
    slug: dto.slug,
    title: toLocalizedText(dto.title),
    headline: dto.headline ? toLocalizedText(dto.headline) : {},
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
    listed: dto.listed ?? true,
    accessToken: AccessToken.create(dto.accessToken),
  };
}

/** Valores por defecto para los campos que un borrador puede no traer todavía. */
export function toDraftCuratedProfileProps(dto: PreviewCuratedProfileDto): NewCuratedProfileProps {
  return {
    slug: dto.slug ?? 'preview',
    title: dto.title ? toLocalizedText(dto.title) : {},
    headline: dto.headline ? toLocalizedText(dto.headline) : {},
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
  if (dto.listed !== undefined) c.listed = dto.listed;
  if (dto.visibility !== undefined) c.visibility = dto.visibility;
  if (dto.accessToken !== undefined) c.accessToken = AccessToken.create(dto.accessToken);
  return c;
}
