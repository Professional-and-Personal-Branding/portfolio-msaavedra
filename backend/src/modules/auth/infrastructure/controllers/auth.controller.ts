import { Body, Controller, Get, HttpCode, Post, Res, UseGuards, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { NodeEnv } from '../../../../config/env.validation';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { AdminOutput, AuthenticatedAdmin, LoginOutput } from '../../application/dto/auth.output';
import { ChangeAdminPasswordUseCase } from '../../application/use-cases/change-admin-password.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { CurrentAdmin } from '../security/current-admin.decorator';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { LoginRateLimitGuard } from '../security/login-rate-limit.guard';
import { PasswordChangeRateLimitGuard } from '../security/password-change-rate-limit.guard';
import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../security/session-cookie';
import { AdminResponse, LoginResponse } from './docs/auth.response';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@UsePipes(adminValidationPipe)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly changePassword: ChangeAdminPasswordUseCase,
    private readonly config: ConfigService,
  ) {}

  private get appConfig(): AppConfig {
    return this.config.getOrThrow<AppConfig>(APP_CONFIG);
  }

  private get isProduction(): boolean {
    return this.appConfig.nodeEnv === NodeEnv.Production;
  }

  @Post('login')
  @HttpCode(200)
  // Freno propio contra fuerza bruta (spec `api-rate-limiting`).
  @UseGuards(LoginRateLimitGuard)
  @ApiOperation({
    summary: 'Login del backoffice',
    description:
      'Devuelve un JWT Bearer y lo emite además como cookie de sesión `portfolio_session` (httpOnly), que usa el panel de administración.',
  })
  @ApiOkResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Credenciales incorrectas' })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Demasiados intentos' })
  async doLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginOutput> {
    const result = await this.login.execute({ email: dto.email, password: dto.password });
    if (!result.ok) throw toHttpException(result.error);

    this.setSessionCookie(res, result.value);
    return result.value;
  }

  @Post('password')
  @HttpCode(200)
  // El límite va después del guard de sesión: una petición anónima da 401 sin consumir el cupo.
  @UseGuards(JwtAuthGuard, PasswordChangeRateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar la contraseña del administrador',
    description:
      'Exige la contraseña actual, guarda la nueva (12 a 256 caracteres, distinta de la actual) e invalida todas las demás sesiones (`sessionVersion`). Responde como el login, con un token nuevo y la cookie `portfolio_session` reemitida para la sesión que cambió; el token con el que se hizo la petición deja de valer.',
  })
  @ApiOkResponse({ type: LoginResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido o política' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Sin sesión, sesión revocada o contraseña actual incorrecta',
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Demasiados intentos' })
  async doChangePassword(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginOutput> {
    const result = await this.changePassword.execute({
      adminId: admin.id,
      sessionVersion: admin.sessionVersion,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
    if (!result.ok) throw toHttpException(result.error);

    this.setSessionCookie(res, result.value);
    return result.value;
  }

  private setSessionCookie(res: Response, session: LoginOutput): void {
    res.cookie(
      SESSION_COOKIE_NAME,
      session.accessToken,
      buildSessionCookieOptions(
        session.expiresIn,
        this.isProduction,
        this.appConfig.sessionCookieSameSite,
      ),
    );
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cierre de sesión del backoffice',
    description: 'Borra la cookie de sesión. No requiere una sesión válida.',
  })
  @ApiNoContentResponse({ description: 'Cookie borrada' })
  doLogout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(
      SESSION_COOKIE_NAME,
      buildClearSessionCookieOptions(this.isProduction, this.appConfig.sessionCookieSameSite),
    );
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
  me(@CurrentAdmin() admin: AuthenticatedAdmin): AdminOutput {
    // No expone la versión de sesión.
    return { id: admin.id, email: admin.email, name: admin.name };
  }
}
