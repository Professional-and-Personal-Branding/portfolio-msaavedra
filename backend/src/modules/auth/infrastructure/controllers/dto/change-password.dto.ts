import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Primer filtro; el dominio manda (`validateNewPassword` cuenta puntos de código y compara con la
 * actual). 256 es el mismo tope que `LoginDto`: acota además el costo de argon2.
 */
export class ChangePasswordDto {
  @ApiProperty({ example: 'la-contraseña-actual', description: 'Contraseña vigente.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword!: string;

  @ApiProperty({
    example: 'una-contraseña-nueva-y-larga',
    minLength: 12,
    maxLength: 256,
    description: 'De 12 a 256 caracteres y distinta de la actual. No se recortan espacios.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword!: string;
}
