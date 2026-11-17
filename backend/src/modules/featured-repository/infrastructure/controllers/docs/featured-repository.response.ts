import { ApiProperty } from '@nestjs/swagger';
import {
  FeaturedRepositoryOutput,
  RepositoryEvidenceLanguageOutput,
  RepositoryEvidenceOutput,
} from '../../../application/dto/featured-repository.output';

export class RepositoryEvidenceLanguageResponse implements RepositoryEvidenceLanguageOutput {
  @ApiProperty({ example: 'Java' }) name!: string;
  @ApiProperty({ example: 82, description: 'Porcentaje entero por bytes (sin 0 %).' })
  percent!: number;
}

/** Evidencia verificada contra GitHub (change `add-github-code-evidence`). */
export class RepositoryEvidenceResponse implements RepositoryEvidenceOutput {
  @ApiProperty({ example: 12 }) stars!: number;
  @ApiProperty({ type: [RepositoryEvidenceLanguageResponse], description: 'Hasta 3, por bytes.' })
  languages!: RepositoryEvidenceLanguageResponse[];
  @ApiProperty({
    type: [String],
    description: 'Hasta 5 topics de GitHub, sin repetir las tecnologías cargadas a mano.',
  })
  topics!: string[];
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) pushedAt!: string | null;
  @ApiProperty() archived!: boolean;
  @ApiProperty({ format: 'date-time', description: 'Última verificación contra GitHub.' })
  verifiedAt!: string;
}

export class FeaturedRepositoryResponse implements FeaturedRepositoryOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'reservas-api' }) name!: string;
  @ApiProperty({ example: 'https://github.com/octo-org/reservas-api' }) url!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Java',
    description: 'Lenguaje efectivo: el manual o, si falta, el principal verificado en GitHub.',
  })
  language!: string | null;
  @ApiProperty({ description: 'Resuelta al locale.' }) description!: string;
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String], description: 'Tags para el filtrado de perfiles curados' })
  tags!: string[];
  @ApiProperty() order!: number;
  @ApiProperty({
    nullable: true,
    type: RepositoryEvidenceResponse,
    description:
      'Nulo si no hay evidencia válida (no verificado, privado, no encontrado o URL nueva).',
  })
  evidence!: RepositoryEvidenceResponse | null;
}
