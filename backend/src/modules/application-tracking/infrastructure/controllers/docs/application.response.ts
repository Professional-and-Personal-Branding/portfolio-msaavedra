import { ApiProperty } from '@nestjs/swagger';
import {
  ApplicationOutput,
  ApplicationShareLinkOutput,
  ApplicationSummaryOutput,
} from '../../../application/dto/application.output';
import { APPLICATION_STATUSES, ApplicationStatus } from '../../../domain/application-status';

export class ApplicationShareLinkResponse implements ApplicationShareLinkOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Globex — RR. HH.' }) label!: string;
  @ApiProperty({ example: 'k7m2q9xw4t', description: 'Código de `?via=`' }) code!: string;
  @ApiProperty() revoked!: boolean;
  @ApiProperty({ description: 'Aperturas de personas (`HUMAN`) en toda la historia del enlace' })
  opens!: number;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601 de la primera apertura' })
  firstOpenedAt!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601 de la última apertura' })
  lastOpenedAt!: string | null;
}

export class ApplicationResponse implements ApplicationOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Globex' }) company!: string;
  @ApiProperty({ example: 'Backend Senior' }) role!: string;
  @ApiProperty({ nullable: true, type: String }) jobUrl!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'linkedin' }) portal!: string | null;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
  @ApiProperty({ enum: APPLICATION_STATUSES, enumName: 'ApplicationStatus' })
  status!: ApplicationStatus;
  @ApiProperty({ nullable: true, type: String, example: '2026-11-20', description: 'AAAA-MM-DD' })
  appliedAt!: string | null;
  @ApiProperty({ description: 'ISO 8601 del último cambio efectivo de estado' })
  statusChangedAt!: string;
  @ApiProperty({ nullable: true, type: String }) curatedProfileId!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'ejemplo-backend' })
  profileSlug!: string | null;
  @ApiProperty({ nullable: true, type: () => ApplicationShareLinkResponse })
  shareLink!: ApplicationShareLinkResponse | null;
  @ApiProperty({
    enum: APPLICATION_STATUSES,
    enumName: 'ApplicationStatus',
    isArray: true,
    description: 'Estados a los que puede pasar desde el actual (vacío si es final)',
  })
  nextStatuses!: ApplicationStatus[];
  @ApiProperty({ description: 'ISO 8601' }) createdAt!: string;
  @ApiProperty({ description: 'ISO 8601' }) updatedAt!: string;
}

export class ApplicationSummaryResponse implements ApplicationSummaryOutput {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Los siete estados, ceros incluidos',
    example: {
      DRAFT: 0,
      APPLIED: 2,
      INTERVIEWING: 1,
      OFFER: 0,
      ACCEPTED: 0,
      REJECTED: 3,
      WITHDRAWN: 0,
    },
  })
  byStatus!: Record<ApplicationStatus, number>;
  @ApiProperty({ description: 'DRAFT + APPLIED + INTERVIEWING + OFFER' }) active!: number;
}
