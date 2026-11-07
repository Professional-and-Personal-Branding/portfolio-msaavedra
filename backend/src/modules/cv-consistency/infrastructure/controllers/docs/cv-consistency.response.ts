import { ApiProperty } from '@nestjs/swagger';
import {
  CvConsistencyReport,
  CvExperienceSummary,
  CvIssueOutput,
} from '../../../application/cv-consistency.output';
import {
  CV_ENTITY_TYPES,
  CV_ISSUE_CODES,
  CV_SEVERITIES,
  CvEntityType,
  CvIssueCode,
  CvIssueParams,
  CvSeverity,
} from '../../../domain/cv-issue';

export class CvIssueResponse implements CvIssueOutput {
  @ApiProperty({ enum: CV_ISSUE_CODES, enumName: 'CvIssueCode', example: 'profile.years-mismatch' })
  code!: CvIssueCode;
  @ApiProperty({
    enum: CV_SEVERITIES,
    enumName: 'CvSeverity',
    description:
      '`error`: la API la rechazaría o rompe el render; `warning`: descuido visible; `info`: suele ser legítimo',
  })
  severity!: CvSeverity;
  @ApiProperty({ enum: CV_ENTITY_TYPES, enumName: 'CvEntityType' }) entityType!: CvEntityType;
  @ApiProperty({ description: 'Id exacto del ítem' }) entityId!: string;
  @ApiProperty({ example: 'Manuel Saavedra', description: 'Nombre legible del ítem' })
  entityLabel!: string;
  @ApiProperty({ nullable: true, type: String, example: 'yearsOfExperience' })
  field!: string | null;
  @ApiProperty({ description: 'Resuelto en el idioma pedido' }) message!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    example: { declared: 10, months: 103, years: 8, remainderMonths: 7 },
  })
  params!: CvIssueParams;
}

export class CvExperienceSummaryResponse implements CvExperienceSummary {
  @ApiProperty({ example: 10, description: '`Profile.yearsOfExperience`, tal como se cargó' })
  declaredYears!: number;
  @ApiProperty({ example: 103, description: 'Meses fusionados de todas las experiencias' })
  derivedMonths!: number;
}

export class CvSeveritySummaryResponse implements Record<CvSeverity, number> {
  @ApiProperty() error!: number;
  @ApiProperty() warning!: number;
  @ApiProperty() info!: number;
}

export class CvConsistencyResponse implements CvConsistencyReport {
  @ApiProperty({ example: '2026-11', description: 'Mes de referencia (UTC)' }) asOf!: string;
  @ApiProperty({
    type: CvExperienceSummaryResponse,
    nullable: true,
    description: 'null si todavía no hay perfil base',
  })
  experience!: CvExperienceSummaryResponse | null;
  @ApiProperty({ type: CvSeveritySummaryResponse }) summary!: CvSeveritySummaryResponse;
  @ApiProperty({
    type: [CvIssueResponse],
    description: 'Ordenados por severidad, tipo de entidad, etiqueta y código',
  })
  issues!: CvIssueResponse[];
}
