import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LocaleQueryDto } from '../../../../../shared/infrastructure/http/locale-query.dto';

/** Query del detalle: idioma + token de acceso opcional (alternativa al header `X-Access-Token`). */
export class CuratedProfileQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({
    description:
      'Token de acceso para perfiles PROTECTED (alternativa al header `X-Access-Token`, que tiene prioridad).',
  })
  @IsOptional()
  @IsString()
  token?: string;
}
