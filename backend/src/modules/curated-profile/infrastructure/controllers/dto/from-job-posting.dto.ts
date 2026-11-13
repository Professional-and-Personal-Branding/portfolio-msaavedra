import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Cuerpo de crear un borrador desde una vacante (change `add-job-posting-intake`, D17). Los
 * `filterTags` deben existir en los datos del owner: lo valida el caso de uso y da 400 nombrando
 * los desconocidos.
 */
export class CreateCuratedProfileFromJobPostingDto {
  @ApiProperty({ description: 'Id de la vacante importada' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  jobPostingId!: string;

  @ApiProperty({
    type: [String],
    description: '1 a 20 tags, sin repetidos, todos del vocabulario de tus datos',
    example: ['java', 'spring-boot'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  filterTags!: string[];

  @ApiPropertyOptional({
    description: 'Título del perfil (1 a 120). Sin él, el de la vacante.',
    example: 'Tech Lead Backend en Acme Ejemplo',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    description:
      'Slug kebab-case. Sin él se arma con la empresa y el puesto, con el primer sufijo libre.',
    example: 'acme-ejemplo-tech-lead',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;
}
