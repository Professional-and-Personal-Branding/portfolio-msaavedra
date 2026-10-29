import { ApiProperty } from '@nestjs/swagger';
import { ShareLinkOutput } from '../../../application/dto/share-link.output';
import { SHARE_LINK_KINDS, ShareLinkKind } from '../../../domain/entities/share-link.entity';

export class ShareLinkResponse implements ShareLinkOutput {
  @ApiProperty() id!: string;
  @ApiProperty({
    example: 'k7m2q9xw4t',
    description: '10 caracteres de `0123456789abcdefghjkmnpqrstvwxyz`; va en `?via=` del link',
  })
  code!: string;
  @ApiProperty({ example: 'Acme — María, RR. HH.' }) label!: string;
  @ApiProperty({ nullable: true, type: String, example: 'linkedin' }) portal!: string | null;
  @ApiProperty({ enum: SHARE_LINK_KINDS, enumName: 'ShareLinkKind' }) kind!: ShareLinkKind;
  @ApiProperty({ description: 'ISO 8601' }) createdAt!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO 8601 si está revocado (irreversible); null si está activo',
  })
  revokedAt!: string | null;
  @ApiProperty({ description: 'Aperturas de personas (`HUMAN`) en toda la historia del enlace' })
  opens!: number;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601 de la última apertura' })
  lastOpenedAt!: string | null;
}
