import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { LocaleQueryDto } from '../../../../../shared/infrastructure/http/locale-query.dto';

/**
 * Atribución que viaja en el link: toma el primer valor si el parámetro se repite y descarta lo
 * que no sea texto. No rechaza nunca: un link mal copiado no da 400 y el perfil se ve igual.
 */
function firstString({ value }: { value: unknown }): string | undefined {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first : undefined;
}

/** Query del detalle: idioma + token de acceso opcional (alternativa al header `X-Access-Token`). */
export class CuratedProfileQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({
    description:
      'Token de acceso para perfiles PROTECTED (alternativa al header `X-Access-Token`, que tiene prioridad).',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description:
      'Código de un enlace de seguimiento (10 caracteres). Solo atribuye la visita: la respuesta es idéntica con un código válido, revocado, inexistente o sin él, y un valor mal formado nunca da 400.',
    example: 'k7m2q9xw4t',
  })
  @Transform(firstString)
  via?: string;

  @ApiPropertyOptional({
    description:
      'Portal de origen (`[a-z0-9-]`, hasta 32 caracteres, se normaliza a minúsculas). Solo atribuye la visita; un valor inválido se descarta sin error.',
    example: 'indeed',
  })
  @Transform(firstString)
  src?: string;
}
