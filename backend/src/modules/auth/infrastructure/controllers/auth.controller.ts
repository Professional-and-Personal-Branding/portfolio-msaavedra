import { Body, Controller, Get, HttpCode, Post, UseGuards, UsePipes } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { AdminOutput, LoginOutput } from '../../application/dto/auth.output';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { CurrentAdmin } from '../security/current-admin.decorator';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { AdminResponse, LoginResponse } from './docs/auth.response';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@UsePipes(adminValidationPipe)
@Controller('auth')
export class AuthController {
  constructor(private readonly login: LoginUseCase) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login del backoffice', description: 'Devuelve un JWT Bearer.' })
  @ApiOkResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Credenciales incorrectas' })
  async doLogin(@Body() dto: LoginDto): Promise<LoginOutput> {
    const result = await this.login.execute({ email: dto.email, password: dto.password });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Administrador autenticado' })
  @ApiOkResponse({ type: AdminResponse })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  me(@CurrentAdmin() admin: AdminOutput): AdminOutput {
    return admin;
  }
}
