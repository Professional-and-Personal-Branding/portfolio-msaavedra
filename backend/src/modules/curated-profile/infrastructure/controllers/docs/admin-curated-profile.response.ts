import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { AdminCuratedProfileOutput } from '../../../application/dto/curated-profile.admin-output';
import {
  CURATED_VISIBILITIES,
  CuratedVisibility,
} from '../../../domain/entities/curated-profile.entity';

export class AdminCuratedProfileResponse implements AdminCuratedProfileOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'tech-lead-dotnet' }) slug!: string;
  @ApiProperty({ type: LocalizedTextDto }) title!: LocalizedText | string;
  @ApiProperty({ type: LocalizedTextDto }) headline!: LocalizedText | string;
  @ApiProperty({ type: LocalizedTextDto, nullable: true }) description!:
    LocalizedText | string | null;
  @ApiProperty({ type: LocalizedTextDto, nullable: true }) roleType!: LocalizedText | string | null;
  @ApiProperty({ nullable: true, type: String }) techFocus!: string | null;
  @ApiProperty({ type: [String] }) filterTags!: string[];
  @ApiProperty({ type: [String] }) includeIds!: string[];
  @ApiProperty({ type: [String] }) excludeIds!: string[];
  @ApiProperty({ example: '#5B2C87' }) accentColor!: string;
  @ApiProperty({ nullable: true, type: String }) themeId!: string | null;
  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  themeOverrides!: unknown;
  @ApiProperty({ example: 'classic' }) layout!: string;
  @ApiProperty({ type: [String] }) sectionsOrder!: string[];
  @ApiProperty({ type: [String] }) sectionsHidden!: string[];
  @ApiProperty({ enum: CURATED_VISIBILITIES }) visibility!: CuratedVisibility;
  @ApiProperty({ nullable: true, type: String }) accessToken!: string | null;
  @ApiProperty() views!: number;
  @ApiProperty({ nullable: true, type: String }) createdAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) updatedAt!: string | null;
}
