import { ApiProperty } from '@nestjs/swagger';
import { SocialLinkOutput } from '../../../application/dto/social-link.output';

export class SocialLinkResponse implements SocialLinkOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'github' }) platform!: string;
  @ApiProperty({ example: 'manuXD270516' }) handle!: string;
  @ApiProperty({ example: 'https://github.com/manuXD270516' }) url!: string;
  @ApiProperty({ description: 'Resuelto al locale.' }) label!: string;
  @ApiProperty({ description: 'Resuelto al locale; vacío si no hay.' }) description!: string;
  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: { repos: 67, achievements: ['Pull Shark'] },
  })
  stats!: Record<string, unknown> | null;
  @ApiProperty() featured!: boolean;
  @ApiProperty() order!: number;
}
