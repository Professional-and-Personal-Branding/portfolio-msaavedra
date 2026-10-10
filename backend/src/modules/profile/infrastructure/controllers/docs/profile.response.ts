import { ApiProperty } from '@nestjs/swagger';
import {
  AvailabilityOutput,
  LanguageOutput,
  ProfileOutput,
} from '../../../application/dto/profile.output';

/** Modelos Swagger de la respuesta. Implementan el DTO de aplicación para no divergir. */
export class LanguageResponse implements LanguageOutput {
  @ApiProperty({ example: 'Español' })
  name!: string;

  @ApiProperty({ example: 'Nativo', description: 'Nivel resuelto al idioma pedido' })
  level!: string;

  @ApiProperty({ example: 'Oral, escrito y lectura avanzados' })
  detail!: string;
}

export class AvailabilityResponse implements AvailabilityOutput {
  @ApiProperty({ example: 'Remoto / Presencial (Santa Cruz)' })
  modality!: string;

  @ApiProperty({ example: 'Relación de dependencia · Freelance / Contractor' })
  contractType!: string;

  @ApiProperty({ example: 'Inmediata' })
  startDate!: string;
}

export class ProfileResponse implements ProfileOutput {
  @ApiProperty({ example: 'clx0abc123' })
  id!: string;

  @ApiProperty({ example: 'Manuel Joaquín Saavedra Severiche' })
  fullName!: string;

  @ApiProperty({
    description: 'Resuelto al locale del request.',
    example: 'Senior Software Engineer · Backend & Cloud',
  })
  headline!: string;

  @ApiProperty({ example: 'Santa Cruz de la Sierra, Bolivia' })
  location!: string;

  @ApiProperty({ example: 'GMT-4' })
  timezone!: string;

  @ApiProperty({ example: 'correo@example.com' })
  email!: string;

  @ApiProperty({ nullable: true, type: String, example: '+591 70000000' })
  phone!: string | null;

  @ApiProperty({ description: 'Resuelto al locale del request.' })
  summary!: string;

  @ApiProperty({ example: 10 })
  yearsOfExperience!: number;

  @ApiProperty({ type: AvailabilityResponse })
  availability!: AvailabilityResponse;

  @ApiProperty({ type: [LanguageResponse] })
  languages!: LanguageResponse[];
}
