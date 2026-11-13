import { ApiProperty } from '@nestjs/swagger';
import { FeaturedRepositoryOutput } from '../../../application/dto/featured-repository.output';

export class FeaturedRepositoryResponse implements FeaturedRepositoryOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'reservas-api' }) name!: string;
  @ApiProperty({ example: 'https://github.com/octo-org/reservas-api' }) url!: string;
  @ApiProperty({ nullable: true, type: String, example: 'Java' }) language!: string | null;
  @ApiProperty({ description: 'Resuelta al locale.' }) description!: string;
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String], description: 'Tags para el filtrado de perfiles curados' })
  tags!: string[];
  @ApiProperty() order!: number;
}
