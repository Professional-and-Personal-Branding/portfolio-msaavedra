import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de crear un enlace. Los topes son de forma (que no entre texto desmedido); las reglas
 * reales (etiqueta recortada de 1 a 80, portal normalizable) las aplica el dominio y dan 400.
 */
export class CreateShareLinkDto {
  @ApiProperty({
    description: 'Etiqueta para reconocer el enlace en el panel (1 a 80 caracteres)',
    example: 'Acme — María, RR. HH.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({
    description:
      'Portal donde se publica (`[a-z0-9-]`, hasta 32 caracteres; se normaliza a minúsculas). Inmutable.',
    example: 'linkedin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  portal?: string;
}

export class UpdateShareLinkDto {
  @ApiProperty({ description: 'Etiqueta nueva (1 a 80 caracteres)', example: 'Acme — Juan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;
}
