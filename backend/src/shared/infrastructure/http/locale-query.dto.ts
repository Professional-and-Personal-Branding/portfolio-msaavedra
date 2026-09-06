import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { SUPPORTED_LOCALES } from '../../domain/i18n';

/**
 * Query params de idioma. Solo documenta y admite los parámetros en Swagger;
 * la resolución real la hace `@RequestLocale()` (un valor no soportado cae al
 * default, nunca es 400).
 */
export class LocaleQueryDto {
  @ApiPropertyOptional({
    description: 'Idioma de la respuesta (prioridad sobre `lang` y `Accept-Language`).',
    enum: SUPPORTED_LOCALES,
    example: 'es',
  })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({
    description: 'Alias de `locale`.',
    enum: SUPPORTED_LOCALES,
  })
  @IsOptional()
  @IsString()
  lang?: string;
}
