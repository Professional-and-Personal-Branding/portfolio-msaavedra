import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { loadConfiguration } from './config/configuration';
import { ExperienceModule } from './modules/experience/experience.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ContentLanguageInterceptor } from './shared/infrastructure/http/content-language.interceptor';
import { PrismaModule } from './shared/infrastructure/persistence/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfiguration],
      // El .env local lo lee Nest; en producción las variables vienen del entorno.
      envFilePath: ['.env'],
    }),
    PrismaModule,
    ProfileModule,
    ExperienceModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ContentLanguageInterceptor }],
})
export class AppModule {}
