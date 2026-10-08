import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { AdminProjectOutput } from '../../../application/dto/project.admin-output';

/** Salida admin: campos traducibles crudos `{ es, en }`. */
export class AdminProjectResponse implements AdminProjectOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Portafolio Web Administrable' }) name!: string;
  @ApiProperty({ type: LocalizedTextDto }) role!: LocalizedText | string;
  @ApiProperty({ example: '2026' }) period!: string;
  @ApiProperty({ type: LocalizedTextDto }) summary!: LocalizedText | string;
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ nullable: true, type: String }) url!: string | null;
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
}
