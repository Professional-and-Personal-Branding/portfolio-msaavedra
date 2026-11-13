import { ApiProperty } from '@nestjs/swagger';
import {
  CoveredTagOutput,
  JobPostingOutput,
  JobPostingSuggestionOutput,
  TagCoverageOutput,
} from '../../../application/dto/job-posting.output';
import {
  JOB_POSTING_SOURCES,
  JobPostingSourceKind,
  WORKPLACE_TYPES,
  WorkplaceType,
} from '../../../domain/entities/job-posting.entity';

export class JobPostingResponse implements JobPostingOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: JOB_POSTING_SOURCES, enumName: 'JobPostingSourceKind' })
  source!: JobPostingSourceKind;
  @ApiProperty({ nullable: true, type: String, description: 'URL canónica pedida o de referencia' })
  sourceUrl!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Solo https' }) applyUrl!:
    string | null;
  @ApiProperty({ example: 'Tech Lead Backend' }) title!: string;
  @ApiProperty({ nullable: true, type: String, example: 'Acme Ejemplo' }) company!: string | null;
  @ApiProperty({ nullable: true, type: String }) location!: string | null;
  @ApiProperty({ nullable: true, enum: WORKPLACE_TYPES, enumName: 'WorkplaceType' })
  workplaceType!: WorkplaceType | null;
  @ApiProperty({ nullable: true, type: String }) employmentType!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Tal como lo da la fuente' })
  compensation!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'es' }) language!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601' }) postedAt!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Texto plano (hasta 20 000); `null` después de la purga',
  })
  description!: string | null;
  @ApiProperty() descriptionTruncated!: boolean;
  @ApiProperty({ type: [String], example: ['java', 'kubernetes'] }) detectedTerms!: string[];
  @ApiProperty({ description: 'ISO 8601' }) importedAt!: string;
  @ApiProperty({ description: 'ISO 8601: cuándo se borra (o se borró) el texto' })
  textPurgeAt!: string;
  @ApiProperty({ description: '`true` si el texto ya se borró' }) textPurged!: boolean;
  @ApiProperty({ description: 'ISO 8601' }) createdAt!: string;
  @ApiProperty({ description: 'ISO 8601' }) updatedAt!: string;
}

export class CoveredTagResponse implements CoveredTagOutput {
  @ApiProperty({ example: 'java' }) tag!: string;
  @ApiProperty({ description: 'Ítems visibles de tus datos que llevan el tag', example: 3 })
  evidence!: number;
}

export class TagCoverageResponse implements TagCoverageOutput {
  @ApiProperty({ type: [CoveredTagResponse] }) covered!: CoveredTagResponse[];
  @ApiProperty({ type: [String], description: 'Detectados sin respaldo en tus datos' })
  uncovered!: string[];
  @ApiProperty() detectedCount!: number;
  @ApiProperty() coveredCount!: number;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: '`coveredCount / detectedCount` a dos decimales; `null` si no se detectó nada',
  })
  ratio!: number | null;
}

export class JobPostingSuggestionResponse implements JobPostingSuggestionOutput {
  @ApiProperty({ type: TagCoverageResponse }) coverage!: TagCoverageResponse;
  @ApiProperty({
    type: [String],
    description: 'Hasta 8; siempre dentro del vocabulario de tags de tus datos, sin repetidos',
  })
  suggestedFilterTags!: string[];
  @ApiProperty({ description: 'Hasta 120 caracteres' }) suggestedTitle!: string;
  @ApiProperty({ example: 'acme-ejemplo-tech-lead-backend' }) suggestedSlugBase!: string;
}
