import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import {
  AdminFeaturedRepositoryOutput,
  AdminRepositoryEvidenceOutput,
} from '../../../application/dto/featured-repository.admin-output';
import {
  REPOSITORY_EVIDENCE_STATUSES,
  RepositoryEvidenceStatus,
} from '../../../domain/value-objects/repository-evidence';

/** Evidencia cruda para el panel (change `add-github-code-evidence`, D12). */
export class AdminRepositoryEvidenceResponse implements AdminRepositoryEvidenceOutput {
  @ApiProperty({ enum: REPOSITORY_EVIDENCE_STATUSES }) status!: RepositoryEvidenceStatus;
  @ApiProperty({ example: 'octo-org/reservas-api' }) repoKey!: string;
  @ApiProperty({ nullable: true, type: Number }) stars!: number | null;
  @ApiProperty({ nullable: true, type: String }) primaryLanguage!: string | null;
  @ApiProperty({ type: [String] }) topics!: string[];
  @ApiProperty() archived!: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'full_name si GitHub lo movió.' })
  movedTo!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Solo referencia para curar.' })
  githubDescription!: string | null;
  @ApiProperty({ format: 'date-time' }) verifiedAt!: string;
  @ApiProperty({ format: 'date-time' }) changedAt!: string;
  @ApiProperty({ description: 'La URL cambió desde la última sincronización.' }) stale!: boolean;
}

/** Salida admin: la descripción cruda `{ es, en }`. */
export class AdminFeaturedRepositoryResponse implements AdminFeaturedRepositoryOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'reservas-api' }) name!: string;
  @ApiProperty({ example: 'https://github.com/octo-org/reservas-api' }) url!: string;
  @ApiProperty({ nullable: true, type: String, example: 'Java' }) language!: string | null;
  @ApiProperty({ type: LocalizedTextDto }) description!: LocalizedText | string;
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
  @ApiProperty({ nullable: true, type: AdminRepositoryEvidenceResponse })
  evidence!: AdminRepositoryEvidenceResponse | null;
}
