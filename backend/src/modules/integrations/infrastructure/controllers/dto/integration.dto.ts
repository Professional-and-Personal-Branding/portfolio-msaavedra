import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SetIntegrationEnabledDto {
  @ApiProperty({ description: '`false` pausa el proveedor a mano; `true` lo reanuda' })
  @IsDefined()
  @IsBoolean()
  enabled!: boolean;
}

export class SaveCredentialDto {
  @ApiProperty({
    description:
      'Secreto del proveedor (1 a 4096 caracteres, sin espacios al borde). Solo se escribe: nunca se devuelve.',
    minLength: 1,
    maxLength: 4096,
  })
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  @Matches(/^\S(?:[\s\S]*\S)?$/, { message: 'secret no puede tener espacios al borde' })
  secret!: string;
}
