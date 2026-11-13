import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, AppConfig, loadConfiguration } from './config/configuration';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApplicationTrackingModule } from './modules/application-tracking/application-tracking.module';
import { AuthModule } from './modules/auth/auth.module';
import { CvConsistencyModule } from './modules/cv-consistency/cv-consistency.module';
import { CuratedProfileModule } from './modules/curated-profile/curated-profile.module';
import { EducationModule } from './modules/education/education.module';
import { FeaturedRepositoryModule } from './modules/featured-repository/featured-repository.module';
import { ProjectModule } from './modules/project/project.module';
import { SocialLinkModule } from './modules/social-link/social-link.module';
import { ExperienceModule } from './modules/experience/experience.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AllExceptionsFilter } from './shared/infrastructure/http/all-exceptions.filter';
import { buildLoggerOptions } from './shared/infrastructure/http/logger.options';
import { ContentLanguageInterceptor } from './shared/infrastructure/http/content-language.interceptor';
import { BackgroundTasksModule } from './shared/infrastructure/background/background-tasks.module';
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
    BackgroundTasksModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    ExperienceModule,
    CuratedProfileModule,
    AnalyticsModule,
    EducationModule,
    ProjectModule,
    FeaturedRepositoryModule,
    SocialLinkModule,
    ApplicationTrackingModule,
    CvConsistencyModule,
    IntegrationsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ContentLanguageInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
