import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, AppConfig, loadConfiguration } from './config/configuration';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { CuratedProfileModule } from './modules/curated-profile/curated-profile.module';
import { EducationModule } from './modules/education/education.module';
import { ProjectModule } from './modules/project/project.module';
import { SocialLinkModule } from './modules/social-link/social-link.module';
import { ExperienceModule } from './modules/experience/experience.module';
import { HealthModule } from './modules/health/health.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AllExceptionsFilter } from './shared/infrastructure/http/all-exceptions.filter';
import { buildLoggerOptions } from './shared/infrastructure/http/logger.options';
import { ContentLanguageInterceptor } from './shared/infrastructure/http/content-language.interceptor';
import { RequestIdMiddleware } from './shared/infrastructure/http/request-id';
import { PrismaModule } from './shared/infrastructure/persistence/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfiguration],
      // El .env local lo lee Nest; en producción las variables vienen del entorno.
      envFilePath: ['.env'],
    }),
    // Logs estructurados con id de petición y redacción (spec `api-observability`).
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfig>(APP_CONFIG);
        return buildLoggerOptions(config.logLevel, config.isProduction);
      },
    }),
    // Límite de peticiones por IP (spec `api-rate-limiting`).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { throttle } = configService.getOrThrow<AppConfig>(APP_CONFIG);
        return { throttlers: [{ ttl: throttle.ttl * 1000, limit: throttle.limit }] };
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    ExperienceModule,
    CuratedProfileModule,
    AnalyticsModule,
    EducationModule,
    ProjectModule,
    SocialLinkModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ContentLanguageInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Antes que todo: el id de la petición lo usan el logger y el filtro de errores.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
