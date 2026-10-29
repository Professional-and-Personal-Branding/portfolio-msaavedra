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
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'URL https de la página pública de la credencial en el emisor.',
    example: 'https://www.credly.com/badges/00000000-0000-0000-0000-000000000000',
  })
  verificationUrl!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'EJ-2023-0042' })
  credentialId!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'YYYY-MM o YYYY. La vigencia la deriva el cliente.',
    example: '2029-06',
  })
  expiresAt!: string | null;
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
}
