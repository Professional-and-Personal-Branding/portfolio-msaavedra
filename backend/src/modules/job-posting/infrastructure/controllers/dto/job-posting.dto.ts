import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de importar una vacante: `url` **o** `text`, nunca los dos ni ninguno. Los topes de acá
 * son de forma (que no entre texto desmedido); las reglas reales —50 a 50 000 caracteres, https,
 * XOR— las aplica el caso de uso y dan 400. Un campo desconocido también da 400.
 */
export class ImportJobPostingDto {
  @ApiPropertyOptional({
    description:
      'URL https de la vacante: Greenhouse, Lever, Ashby o una página de empleo con JSON-LD. ' +
      'Los portales cerrados (LinkedIn, Indeed…) responden 422. Excluyente con `text`.',
    example: 'https://jobs.lever.co/acmeejemplo/0b1c2d3e-aaaa-bbbb-cccc-1234567890ab',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  url?: string;

  @ApiPropertyOptional({
    description:
      'Texto de la vacante (50 a 50 000 caracteres tras recortar). Excluyente con `url`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  text?: string;

  @ApiPropertyOptional({
    description: 'Título (hasta 200); solo con `text`. Sin él, la primera línea del texto.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  title?: string;

  @ApiPropertyOptional({ description: 'Empresa (hasta 160); solo con `text`.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  company?: string;

  @ApiPropertyOptional({
    description:
      'URL https de referencia (hasta 2048); solo con `text`. Se guarda como `sourceUrl` y nunca se pide.',
    example: 'https://www.linkedin.com/jobs/view/123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  referenceUrl?: string;
}
