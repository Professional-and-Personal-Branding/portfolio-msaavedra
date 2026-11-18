import {
  Controller,
  Get,
  Header,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import { AiRunView } from '../../application/dto/ai-run.view';
import {
  AiUsageOutput,
  GetAiUsageUseCase,
} from '../../application/use-cases/get-ai-usage.use-case';
import { RunAiSmokeTestUseCase } from '../../application/use-cases/run-ai-smoke-test.use-case';
import { AiBusyError } from '../../domain/errors/ai.errors';
import { AiRunResponse, AiUsageResponse } from './docs/ai.response';

/** Límite propio de la prueba de conexión: 5 por minuto, además del global (D14). */
export const AI_SMOKE_RATE_LIMIT = { limit: 5, ttl: 60_000 } as const;

/**
 * IA del panel (D18). Todo bajo `/api/admin/` y con `Cache-Control: no-store`. El uso es de solo
 * lectura; la única ruta que escribe es la prueba de conexión.
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin sesión de administrador' })
@UseGuards(JwtAuthGuard)
@Controller('admin/ai')
export class AdminAiController {
  constructor(
    private readonly getUsage: GetAiUsageUseCase,
    private readonly runSmoke: RunAiSmokeTestUseCase,
  ) {}

  @Get('usage')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Gasto de IA del mes',
    description:
      'Responde también con la IA apagada (`state: DISABLED`): solo lee la base. Nunca incluye las ' +
      'entradas ni las salidas de las corridas.',
  })
  @ApiOkResponse({ type: AiUsageResponse })
  async usage(): Promise<AiUsageOutput> {
    return this.getUsage.execute();
  }

  @Post('smoke')
  @Throttle({ default: AI_SMOKE_RATE_LIMIT })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Probar la conexión con el proveedor de IA',
    description:
      'Corre la tarea interna de humo (texto fijo, Haiku 5.5, sin datos del usuario) y devuelve su ' +
      'corrida. Ignora la caché: prueba la conexión de verdad. Con `AI_PROVIDER=fake` no llama a ' +
      'Anthropic. Una llamada que se hizo y falló (transitorio, spend limit, rechazo) responde 201 con ' +
      'la corrida `FAILED` o `REFUSED`. Límite: 5 por minuto.',
  })
  @ApiCreatedResponse({ type: AiRunResponse })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description:
      'La IA está apagada, se alcanzó el tope del mes o Anthropic cortó por su spend limit',
  })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Hay demasiadas consultas de IA en curso; trae `retry-after`',
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Más de 5 por minuto' })
  async smoke(@Res({ passthrough: true }) res: Response): Promise<AiRunView> {
    // Si el owner cierra la pestaña antes de que termine, se aborta la llamada.
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });
    const result = await this.runSmoke.execute({ signal: controller.signal });
    if (!result.ok) {
      if (result.error instanceof AiBusyError) {
        res.setHeader('Retry-After', String(result.error.retryAfterSeconds));
        throw new ServiceUnavailableException(result.error.message);
      }
      throw toHttpException(result.error);
    }
    return result.value;
  }
}
