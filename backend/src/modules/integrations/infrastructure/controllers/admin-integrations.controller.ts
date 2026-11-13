import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import {
  EnqueueSyncOutput,
  IntegrationsOverviewOutput,
  IntegrationStatusOutput,
} from '../../application/dto/integration-status.output';
import { DeleteCredentialUseCase } from '../../application/use-cases/delete-credential.use-case';
import { EnqueueSyncUseCase } from '../../application/use-cases/enqueue-sync.use-case';
import { ListIntegrationsUseCase } from '../../application/use-cases/list-integrations.use-case';
import { SaveCredentialUseCase } from '../../application/use-cases/save-credential.use-case';
import { SetIntegrationEnabledUseCase } from '../../application/use-cases/set-integration-enabled.use-case';
import {
  EnqueueSyncResponse,
  IntegrationsOverviewResponse,
  IntegrationStatusResponse,
} from './docs/integration.response';
import { SaveCredentialDto, SetIntegrationEnabledDto } from './dto/integration.dto';

/**
 * Integraciones del panel (D18). Todo bajo `/api/admin/` y con `Cache-Control: no-store`.
 * Ninguna ruta llama a un conector: «Sincronizar ahora» solo encola (D3).
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin sesión de administrador' })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/integrations')
export class AdminIntegrationsController {
  constructor(
    private readonly listIntegrations: ListIntegrationsUseCase,
    private readonly enqueueSync: EnqueueSyncUseCase,
    private readonly setEnabled: SetIntegrationEnabledUseCase,
    private readonly saveCredential: SaveCredentialUseCase,
    private readonly deleteCredential: DeleteCredentialUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Estado de las integraciones',
    description:
      'Solo aparecen los proveedores de `INTEGRATIONS_ENABLED`. Nunca incluye secretos: de la credencial solo se informa el origen.',
  })
  @ApiOkResponse({ type: IntegrationsOverviewResponse })
  async list(): Promise<IntegrationsOverviewOutput> {
    return this.listIntegrations.execute();
  }

  @Post(':provider/sync')
  @Header('Cache-Control', 'no-store')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Sincronizar ahora',
    description:
      'Solo encola: responde 202 sin llamar al proveedor y el trabajo corre en el próximo tick del ejecutor (hasta 60 s). Si ya hay un trabajo pendiente, en curso o fallido, devuelve ese con `alreadyQueued: true`.',
  })
  @ApiAcceptedResponse({ type: EnqueueSyncResponse })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Proveedor no habilitado' })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'Proveedor pausado a mano',
  })
  async sync(@Param('provider') provider: string): Promise<EnqueueSyncOutput> {
    const result = await this.enqueueSync.execute({ provider });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Patch(':provider')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Pausar o reanudar un proveedor',
    description:
      'Pausar no cancela un trabajo en curso: impide reclamar los siguientes y que el planificador encole.',
  })
  @ApiOkResponse({ type: IntegrationStatusResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Campo desconocido o inválido' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Proveedor no habilitado' })
  async update(
    @Param('provider') provider: string,
    @Body() dto: SetIntegrationEnabledDto,
  ): Promise<IntegrationStatusOutput> {
    const result = await this.setEnabled.execute({ provider, enabled: dto.enabled });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }

  @Put(':provider/credential')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Guardar la credencial de un proveedor',
    description:
      'Se cifra con AES-256-GCM y nunca se devuelve. Con el secreto definido por una variable de entorno, responde 422.',
  })
  @ApiNoContentResponse({ description: 'Guardada' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Secreto vacío, largo o inválido' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Proveedor no habilitado' })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'La credencial de este proveedor viene de una variable de entorno',
  })
  async putCredential(
    @Param('provider') provider: string,
    @Body() dto: SaveCredentialDto,
  ): Promise<void> {
    const result = await this.saveCredential.execute({ provider, secret: dto.secret });
    if (!result.ok) throw toHttpException(result.error);
  }

  @Delete(':provider/credential')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar la credencial guardada en la base (idempotente)' })
  @ApiNoContentResponse({ description: 'Borrada' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Proveedor no habilitado' })
  async removeCredential(@Param('provider') provider: string): Promise<void> {
    const result = await this.deleteCredential.execute({ provider });
    if (!result.ok) throw toHttpException(result.error);
  }
}
