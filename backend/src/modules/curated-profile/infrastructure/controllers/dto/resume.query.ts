import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LocaleQueryDto } from '../../../../../shared/infrastructure/http/locale-query.dto';

/**
 * Query de la exportación JSON Resume: idioma + token de acceso opcional. Sin `via` ni `src`:
 * exportar no registra visita, así que no hay nada que atribuir (D2 de `add-json-resume-export`).
 */
export class ResumeQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({
    description:
      'Token de acceso para perfiles PROTECTED (alternativa al header `X-Access-Token`, que tiene prioridad).',
  })
  @IsOptional()
  @IsString()
  token?: string;
}
