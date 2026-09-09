import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Módulo técnico: solo sondas de estado, sin dominio propio (spec `api-health`). */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
