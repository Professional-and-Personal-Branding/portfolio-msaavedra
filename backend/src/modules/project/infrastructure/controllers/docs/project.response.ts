import { ApiProperty } from '@nestjs/swagger';
import { ProjectOutput } from '../../../application/dto/project.output';

export class ProjectResponse implements ProjectOutput {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Portafolio Web Administrable' }) name!: string;
  @ApiProperty({ description: 'Resuelto al locale.' }) role!: string;
  @ApiProperty({ example: '2026' }) period!: string;
  @ApiProperty({ description: 'Resuelto al locale.' }) summary!: string;
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String], description: 'Tags para el filtrado de perfiles curados' })
  tags!: string[];
  @ApiProperty({ nullable: true, type: String }) url!: string | null;
  @ApiProperty() order!: number;
}
