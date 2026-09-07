import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { LocalizedList, LocalizedText } from '../../../domain/i18n';

/** Texto bilingüe de entrada: `es` obligatorio (idioma origen), `en` opcional (fallback). */
export class LocalizedTextDto implements LocalizedText {
  @ApiProperty({ example: 'Ingeniero de Software Senior' })
  @IsString()
  es!: string;

  @ApiPropertyOptional({ example: 'Senior Software Engineer' })
  @IsOptional()
  @IsString()
  en?: string;
}

/** Lista bilingüe de entrada (ej. highlights). */
export class LocalizedListDto implements LocalizedList {
  @ApiProperty({ type: [String], example: ['Diseño del microservicio de tokenización'] })
  @IsArray()
  @IsString({ each: true })
  es!: string[];

  @ApiPropertyOptional({ type: [String], example: ['Design of the tokenization microservice'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  en?: string[];
}

/** Normaliza un DTO bilingüe a objeto plano sin claves undefined (para persistir como Json). */
export function toLocalizedText(dto: LocalizedTextDto): LocalizedText {
  return dto.en === undefined ? { es: dto.es } : { es: dto.es, en: dto.en };
}

export function toLocalizedList(dto: LocalizedListDto): LocalizedList {
  return dto.en === undefined ? { es: dto.es } : { es: dto.es, en: dto.en };
}
