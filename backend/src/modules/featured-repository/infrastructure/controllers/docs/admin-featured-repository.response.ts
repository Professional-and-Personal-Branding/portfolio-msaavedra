import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { AdminFeaturedRepositoryOutput } from '../../../application/dto/featured-repository.admin-output';

/** Salida admin: la descripción cruda `{ es, en }`. */
export class AdminFeaturedRepositoryResponse implements AdminFeaturedRepositoryOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'reservas-api' }) name!: string;
  @ApiProperty({ example: 'https://github.com/octo-org/reservas-api' }) url!: string;
  @ApiProperty({ nullable: true, type: String, example: 'Java' }) language!: string | null;
  @ApiProperty({ type: LocalizedTextDto }) description!: LocalizedText | string;
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
}
