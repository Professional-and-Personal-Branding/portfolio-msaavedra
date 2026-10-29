import { Controller, Get, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { VIEW_KINDS, ViewKind } from '../../domain/view-kind';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import {
  AggregateProfileViewsUseCase,
  ProfileViewsOutput,
} from '../../application/use-cases/aggregate-profile-views.use-case';
import { parseRangeEnd, parseRangeStart } from '../../domain/services/range-boundaries';

export class ViewsRangeQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 8601; default: hace 30 días. Una fecha sin hora empieza a su medianoche UTC',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601; default: ahora. El rango es cerrado: una fecha sin hora incluye ese día completo',
    example: '2026-09-07',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

class CountBySlug {
  @ApiProperty() slug!: string;
  @ApiProperty() views!: number;
}
class CountByLocale {
  @ApiProperty() locale!: string;
  @ApiProperty() views!: number;
}
class CountByReferrer {
  @ApiProperty({
    example: 'linkedin.com',
    description: 'Host del origen sin `www.`, o `directo` / `interno`',
  })
  referrer!: string;
  @ApiProperty() views!: number;
}
class CountByKind {
  @ApiProperty({ enum: VIEW_KINDS, enumName: 'ViewKind' }) kind!: ViewKind;
  @ApiProperty() views!: number;
}
class CountByDay {
  @ApiProperty({ example: '2026-09-07' }) day!: string;
  @ApiProperty() views!: number;
}

export class ProfileViewsResponse implements ProfileViewsOutput {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ description: 'Solo visitas de personas (`HUMAN`) del rango' }) total!: number;
  @ApiProperty({ type: [CountBySlug], description: 'Solo visitas de personas (`HUMAN`)' })
  byProfile!: CountBySlug[];
  @ApiProperty({ type: [CountByLocale], description: 'Solo visitas de personas (`HUMAN`)' })
  byLocale!: CountByLocale[];
  @ApiProperty({ type: [CountByDay], description: 'Solo visitas de personas (`HUMAN`)' })
  byDay!: CountByDay[];
  @ApiProperty({
    type: [CountByReferrer],
    description:
      'Por origen, descendente. Solo visitas de personas (`HUMAN`): su suma es `total`; solo se agrega el host',
  })
  byReferrer!: CountByReferrer[];
  @ApiProperty({
    type: [CountByKind],
    description:
      'Todas las visitas del rango por tipo, con `HUMAN`, `OWNER` y `BOT` siempre presentes y en ese orden',
  })
  byKind!: CountByKind[];
}

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(
    private readonly aggregate: AggregateProfileViewsUseCase,
    private readonly config: ConfigService,
  ) {}

  @Get('views')
  @ApiOperation({
    summary: 'Visitas de personas agregadas por perfil, idioma, día y origen, y conteo por tipo',
    description:
      'El rango `from`/`to` es cerrado: `to=hoy` incluye las visitas del día en curso. ' +
      'El origen se normaliza al host del `referrer` guardado; las visitas desde el propio sitio cuentan como `interno`. ' +
      '`total` y los desgloses cuentan solo las visitas de personas (`HUMAN`); `byKind` cuenta todas las del rango, también las propias (`OWNER`) y las de bots (`BOT`).',
  })
  @ApiOkResponse({ type: ProfileViewsResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async views(@Query() query: ViewsRangeQueryDto): Promise<ProfileViewsOutput> {
    const result = await this.aggregate.execute({
      from: parseRangeStart(query.from),
      to: parseRangeEnd(query.to),
      siteUrl: this.config.getOrThrow<AppConfig>(APP_CONFIG).frontendUrl,
    });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }
}
