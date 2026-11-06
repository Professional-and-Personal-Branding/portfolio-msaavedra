import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { ADMIN_SESSION_VERIFIER } from '../../shared/application/admin-session-verifier';
import { ChangeAdminPasswordUseCase } from './application/use-cases/change-admin-password.use-case';
import { GetCurrentAdminUseCase } from './application/use-cases/get-current-admin.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port';
import { TOKEN_SIGNER } from './domain/ports/token-signer.port';
import { ADMIN_USER_REPOSITORY } from './domain/repositories/admin-user.repository';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { PrismaAdminUserRepository } from './infrastructure/persistence/prisma-admin-user.repository';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { JwtAdminSessionVerifier } from './infrastructure/security/jwt-admin-session-verifier';
import { JwtAuthGuard } from './infrastructure/security/jwt-auth.guard';
import { JwtTokenSigner } from './infrastructure/security/jwt-token-signer';
import { JwtStrategy } from './infrastructure/security/jwt.strategy';
import { LoginRateLimitGuard } from './infrastructure/security/login-rate-limit.guard';
import { PasswordChangeRateLimitGuard } from './infrastructure/security/password-change-rate-limit.guard';

/**
 * Autenticación del backoffice. La estrategia `jwt` se registra aquí una sola vez;
 * cualquier módulo puede usar `@UseGuards(JwtAuthGuard)` sin importar AuthModule.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { jwt } = config.getOrThrow<AppConfig>(APP_CONFIG);
        return {
          secret: jwt.secret,
          signOptions: { algorithm: 'HS256', expiresIn: jwt.expiresInSeconds },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: ADMIN_USER_REPOSITORY, useClass: PrismaAdminUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SIGNER, useClass: JwtTokenSigner },
    LoginUseCase,
    ChangeAdminPasswordUseCase,
    GetCurrentAdminUseCase,
    JwtStrategy,
    { provide: ADMIN_SESSION_VERIFIER, useClass: JwtAdminSessionVerifier },
    LoginRateLimitGuard,
    PasswordChangeRateLimitGuard,
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard, PASSWORD_HASHER, ADMIN_USER_REPOSITORY, ADMIN_SESSION_VERIFIER],
})
export class AuthModule {}
