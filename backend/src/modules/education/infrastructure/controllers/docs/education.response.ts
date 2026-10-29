import { ApiProperty } from '@nestjs/swagger';
import { CertificationOutput, EducationOutput } from '../../../application/dto/education.output';

export class EducationResponse implements EducationOutput {
  @ApiProperty() id!: string;
  @ApiProperty({
    description: 'Resuelto al locale.',
    example: 'Doctorado en Ciencias de la Computación',
  })
  degree!: string;
  @ApiProperty({ example: 'UAGRM School of Engineering' }) institution!: string;
  @ApiProperty({ example: '2024-02' }) startDate!: string;
  @ApiProperty({ nullable: true, type: String }) endDate!: string | null;
  @ApiProperty() inProgress!: boolean;
  @ApiProperty() order!: number;
}

export class CertificationResponse implements CertificationOutput {
  @ApiProperty() id!: string;
  @ApiProperty({
    description: 'Resuelto al locale.',
    example: 'Scrum Foundation Professional Certificate',
  })
  name!: string;
  @ApiProperty({ example: 'CertifPro' }) issuer!: string;
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
}
