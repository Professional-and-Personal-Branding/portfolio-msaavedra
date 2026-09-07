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
  @ApiProperty() order!: number;
}
