import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import {
  AdminCertificationOutput,
  AdminEducationOutput,
} from '../../../application/dto/education.admin-output';

/** Salida admin: campos traducibles crudos `{ es, en }`. */
export class AdminEducationResponse implements AdminEducationOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ type: LocalizedTextDto }) degree!: LocalizedText | string;
  @ApiProperty({ example: 'UAGRM School of Engineering' }) institution!: string;
  @ApiProperty({ example: '2024-02' }) startDate!: string;
  @ApiProperty({ nullable: true, type: String }) endDate!: string | null;
  @ApiProperty() inProgress!: boolean;
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
}

/** Salida admin: campos traducibles crudos `{ es, en }`. */
export class AdminCertificationResponse implements AdminCertificationOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ type: LocalizedTextDto }) name!: LocalizedText | string;
  @ApiProperty({ example: 'CertifPro, Sunrise Florida, EEUU' }) issuer!: string;
  @ApiProperty({ nullable: true, type: String, example: '2021' }) year!: string | null;
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
}
