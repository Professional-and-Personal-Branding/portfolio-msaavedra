import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LocaleQueryDto } from '../../../../../shared/infrastructure/http/locale-query.dto';

/**
 * Query del fragmento de head: slug + idioma. A propósito no hay `token`: el
 * head no autentica (spec `public-seo`). `slug` es opcional en la validación para
 * que la ruta responda siempre 200; sin slug, el fragmento es el genérico.
 */
export class ProfileHeadQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({ example: 'tech-lead-dotnet', description: 'Slug del perfil curado' })
  @IsOptional()
  @IsString()
  slug?: string;
}
