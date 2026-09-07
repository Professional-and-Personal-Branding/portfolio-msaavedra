import { ApiProperty } from '@nestjs/swagger';
import { LocalizedList, LocalizedText } from '../../../../../shared/domain/i18n';
import {
  LocalizedListDto,
  LocalizedTextDto,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { AdminExperienceOutput } from '../../../application/dto/experience.admin-output';

/** Salida admin: campos traducibles crudos `{ es, en }`. */
export class AdminExperienceResponse implements AdminExperienceOutput {
  @ApiProperty() id!: string;
  @ApiProperty() company!: string;
  @ApiProperty({ type: LocalizedTextDto }) role!: LocalizedText | string;
  @ApiProperty({ example: '2025-01' }) startDate!: string;
  @ApiProperty({ nullable: true, type: String }) endDate!: string | null;
  @ApiProperty() current!: boolean;
  @ApiProperty() location!: string;
  @ApiProperty({ type: LocalizedTextDto }) summary!: LocalizedText | string;
  @ApiProperty({ type: LocalizedListDto }) highlights!: LocalizedList | string[];
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ type: [String] }) sector!: string[];
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
  @ApiProperty({ nullable: true, type: String }) createdAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) updatedAt!: string | null;
}
