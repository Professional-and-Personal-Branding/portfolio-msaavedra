import { Body, Controller, Get, HttpCode, Post, Res, UseGuards, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { NodeEnv } from '../../../../config/env.validation';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { AdminOutput, LoginOutput } from '../../application/dto/auth.output';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { CurrentAdmin } from '../security/current-admin.decorator';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../security/session-cookie';
import { AdminResponse, LoginResponse } from './docs/auth.response';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@UsePipes(adminValidationPipe)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly config: ConfigService,
  ) {}

  private get isProduction(): boolean {
    return this.config.getOrThrow<AppConfig>(APP_CONFIG).nodeEnv === NodeEnv.Production;
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login del backoffice',
    description:
      'Devuelve un JWT Bearer y lo emite además como cookie de sesión `portfolio_session` (httpOnly), que usa el panel de administración.',
  })
  @ApiOkResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Credenciales incorrectas' })
  async doLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginOutput> {
    const result = await this.login.execute({ email: dto.email, password: dto.password });
    if (!result.ok) throw toHttpException(result.error);

    res.cookie(
      SESSION_COOKIE_NAME,
      result.value.accessToken,
      buildSessionCookieOptions(result.value.expiresIn, this.isProduction),
    );
    return result.value;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cierre de sesión del backoffice',
    description: 'Borra la cookie de sesión. No requiere una sesión válida.',
  })
  @ApiNoContentResponse({ description: 'Cookie borrada' })
  doLogout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, buildClearSessionCookieOptions(this.isProduction));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Administrador autenticado',
    description: 'Acepta el JWT por header `Authorization: Bearer` o por la cookie de sesión.',
  })
  @ApiOkResponse({ type: AdminResponse })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  me(@CurrentAdmin() admin: AdminOutput): AdminOutput {
    return admin;
  }
}
