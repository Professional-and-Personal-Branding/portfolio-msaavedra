import { ApiProperty } from '@nestjs/swagger';

/** Forma de todo error HTTP de la API (spec `api-platform`). */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'Experiencia con id "abc" no encontrado' })
  message!: string;

  @ApiProperty({ example: 'Not Found' })
  error!: string;
}
