import { ApiProperty } from '@nestjs/swagger';

/** Documentación Swagger del catálogo de temas (spec `admin-theme-catalog`). */
export class ThemeResponse {
  @ApiProperty({ example: 'clx0theme1' })
  id!: string;

  @ApiProperty({ example: 'modern-dark' })
  slug!: string;

  @ApiProperty({ example: 'Modern Dark' })
  name!: string;

  @ApiProperty({ example: true })
  isPreset!: boolean;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Design tokens del tema base, sin overrides.',
    example: { mode: 'dark', colors: { bg: '#0a0e1a', accent: '#38bdf8' } },
  })
  tokens!: Record<string, unknown>;
}
