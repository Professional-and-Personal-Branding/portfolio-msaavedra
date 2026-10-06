import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { AdminSocialLinkOutput } from '../../../application/dto/social-link.admin-output';

/** Salida admin: campos traducibles crudos `{ es, en }`. */
export class AdminSocialLinkResponse implements AdminSocialLinkOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'github' }) platform!: string;
  @ApiProperty({ example: 'manuXD270516' }) handle!: string;
  @ApiProperty({ example: 'https://github.com/manuXD270516' }) url!: string;
  @ApiProperty({ type: LocalizedTextDto }) label!: LocalizedText | string;
  @ApiProperty({ type: LocalizedTextDto, nullable: true })
  description!: LocalizedText | string | null;
  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: { repos: 67, achievements: ['Pull Shark'] },
  })
  stats!: Record<string, unknown> | null;
  @ApiProperty() featured!: boolean;
  @ApiProperty() order!: number;
  @ApiProperty() visible!: boolean;
}
