import { ApiProperty } from '@nestjs/swagger';
import { LocalizedText } from '../../../../../shared/domain/i18n';
import { LocalizedTextDto } from '../../../../../shared/infrastructure/http/dto/localized.dto';
import {
  AdminSkillCategoryOutput,
  AdminSkillOutput,
} from '../../../application/dto/skill.admin-output';

export class AdminSkillResponse implements AdminSkillOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Kafka Streams' }) name!: string;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() order!: number;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
}

export class AdminSkillCategoryResponse implements AdminSkillCategoryOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ type: LocalizedTextDto }) name!: LocalizedText | string;
  @ApiProperty() order!: number;
  @ApiProperty({ type: [AdminSkillResponse] }) skills!: AdminSkillResponse[];
}
