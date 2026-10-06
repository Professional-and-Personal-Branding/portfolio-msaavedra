import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import {
  AdminAvailabilityOutput,
  AdminLanguageOutput,
  AdminProfileOutput,
} from '../../../application/dto/profile.admin-output';

export class AdminAvailabilityResponse implements AdminAvailabilityOutput {
  @ApiProperty({ type: LocalizedTextDto, nullable: true }) modality!: LocalizedText | string | null;
  @ApiProperty({ type: LocalizedTextDto, nullable: true })
  contractType!: LocalizedText | string | null;
  @ApiProperty({ type: LocalizedTextDto, nullable: true }) startDate!:
    LocalizedText | string | null;
}

/** Perfil base para el backoffice: campos traducibles crudos `{ es, en }`. */
export class AdminProfileResponse implements AdminProfileOutput {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: LocalizedTextDto }) headline!: LocalizedText | string;
  @ApiProperty({ type: LocalizedTextDto }) summary!: LocalizedText | string;
  @ApiProperty() location!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty() yearsOfExperience!: number;
  @ApiProperty({ type: AdminAvailabilityResponse }) availability!: AdminAvailabilityResponse;
}

export class AdminLanguageResponse implements AdminLanguageOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Inglés' }) name!: string;
  @ApiProperty({ type: LocalizedTextDto, nullable: true }) nameI18n!: LocalizedText | string | null;
  @ApiProperty({ example: 'B2' }) level!: string;
  @ApiProperty({ type: LocalizedTextDto, nullable: true }) detail!: LocalizedText | string | null;
}
