import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Forma de todo error HTTP de la API (spec `api-platform`). */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'Experiencia con id "abc" no encontrado' })
  message!: string;

  @ApiProperty({ example: 'Not Found' })
  error!: string;

  @ApiPropertyOptional({
    example: '3f1c9a2e-5b7d-4c8e-9a10-2b3c4d5e6f70',
    description:
      'Identificador de la petición; coincide con la cabecera `X-Request-Id` y con el log.',
  })
  requestId?: string;

  @ApiProperty({ example: '2026-09-08T18:45:02.446Z' })
  timestamp!: string;
}
