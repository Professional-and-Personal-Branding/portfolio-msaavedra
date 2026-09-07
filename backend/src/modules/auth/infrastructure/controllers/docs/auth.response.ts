import { ApiProperty } from '@nestjs/swagger';
import { AdminOutput, LoginOutput } from '../../../application/dto/auth.output';

export class AdminResponse implements AdminOutput {
  @ApiProperty({ example: 'clx0admin' })
  id!: string;

  @ApiProperty({ example: 'admin@example.com' })
  email!: string;

  @ApiProperty({ example: 'Manuel Saavedra' })
  name!: string;
}

export class LoginResponse implements LoginOutput {
  @ApiProperty({ description: 'JWT HS256' })
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Segundos hasta la expiración', example: 86400 })
  expiresIn!: number;

  @ApiProperty({ type: AdminResponse })
  user!: AdminResponse;
}
