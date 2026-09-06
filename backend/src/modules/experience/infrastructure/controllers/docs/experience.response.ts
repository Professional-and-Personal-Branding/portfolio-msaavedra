import { ApiProperty } from '@nestjs/swagger';
import { ExperienceOutput } from '../../../application/dto/experience.output';

/** Modelo Swagger de una experiencia. Implementa el DTO de aplicación para no divergir. */
export class ExperienceResponse implements ExperienceOutput {
  @ApiProperty({ example: 'clx0abc123' })
  id!: string;

  @ApiProperty({ example: 'Novacomp' })
  company!: string;

  @ApiProperty({
    description: 'Resuelto al locale del request.',
    example: 'Senior Fullstack Developer · Fintech',
  })
  role!: string;

  @ApiProperty({ description: 'YYYY-MM', example: '2026-03' })
  startDate!: string;

  @ApiProperty({
    description: 'YYYY-MM; null si es la posición actual',
    nullable: true,
    type: String,
    example: '2026-08',
  })
  endDate!: string | null;

  @ApiProperty({ example: false })
  current!: boolean;

  @ApiProperty({ example: 'Santa Cruz, Bolivia · Remoto' })
  location!: string;

  @ApiProperty({ type: [String], example: ['fintech', 'payments'] })
  sector!: string[];

  @ApiProperty({ description: 'Resuelto al locale del request.' })
  summary!: string;

  @ApiProperty({ description: 'Logros, resueltos al locale del request.', type: [String] })
  highlights!: string[];

  @ApiProperty({ type: [String], example: ['Java', 'Spring Boot'] })
  technologies!: string[];

  @ApiProperty({
    description: 'Tags para el filtrado de perfiles curados.',
    type: [String],
    example: ['java', 'fintech'],
  })
  tags!: string[];

  @ApiProperty({ example: 0 })
  order!: number;
}
