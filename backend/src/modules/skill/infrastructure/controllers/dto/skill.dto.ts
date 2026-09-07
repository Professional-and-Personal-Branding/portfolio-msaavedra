import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LocalizedTextDto,
  toLocalizedText,
} from '../../../../../shared/infrastructure/http/dto/localized.dto';
import { NewSkillCategoryProps } from '../../../domain/entities/skill-category.entity';
import { NewSkillProps } from '../../../domain/entities/skill.entity';

export class CreateSkillCategoryDto {
  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  name!: LocalizedTextDto;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateSkillCategoryDto extends PartialType(CreateSkillCategoryDto) {}

export function toNewSkillCategoryProps(dto: CreateSkillCategoryDto): NewSkillCategoryProps {
  return { name: toLocalizedText(dto.name), order: dto.order ?? 0 };
}

export function toSkillCategoryChanges(
  dto: UpdateSkillCategoryDto,
): Partial<NewSkillCategoryProps> {
  const changes: { -readonly [K in keyof NewSkillCategoryProps]?: NewSkillCategoryProps[K] } = {};
  if (dto.name !== undefined) changes.name = toLocalizedText(dto.name);
  if (dto.order !== undefined) changes.order = dto.order;
  return changes;
}

export class CreateSkillDto {
  @ApiProperty({ example: 'Kafka Streams' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ type: [String], default: [], description: 'Tags para el filtrado' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateSkillDto extends PartialType(CreateSkillDto) {
  @ApiPropertyOptional({ description: 'Mover a otra categoría' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;
}

export function toNewSkillProps(dto: CreateSkillDto): NewSkillProps {
  return { name: dto.name, tags: dto.tags ?? [], order: dto.order ?? 0 };
}

export function toSkillChanges(
  dto: UpdateSkillDto,
): Partial<NewSkillProps & { categoryId: string }> {
  const changes: {
    -readonly [K in keyof (NewSkillProps & { categoryId: string })]?: (NewSkillProps & {
      categoryId: string;
    })[K];
  } = {};
  if (dto.name !== undefined) changes.name = dto.name;
  if (dto.tags !== undefined) changes.tags = dto.tags;
  if (dto.order !== undefined) changes.order = dto.order;
  if (dto.categoryId !== undefined) changes.categoryId = dto.categoryId;
  return changes;
}
