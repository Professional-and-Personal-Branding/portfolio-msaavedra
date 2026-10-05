import { Controller, Get, Query, UseGuards, UsePipes } from '@nestjs/common';
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
import { adminValidationPipe } from '../../../../shared/infrastructure/http/admin-validation.pipe';
import { toHttpException } from '../../../../shared/infrastructure/http/domain-error.mapper';
import { ErrorResponseDto } from '../../../../shared/infrastructure/http/error-response.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/security/jwt-auth.guard';
import {
  AggregateProfileViewsUseCase,
  ProfileViewsOutput,
} from '../../application/use-cases/aggregate-profile-views.use-case';

export class ViewsRangeQueryDto {
  @ApiPropertyOptional({
    description:
      'Día ISO 8601, inclusivo desde las 00:00 UTC; default: hace 29 días (30 días con hoy)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Día ISO 8601, inclusivo hasta el final del día UTC; default: hoy',
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
class CountByDay {
  @ApiProperty({ example: '2026-09-07' }) day!: string;
  @ApiProperty() views!: number;
}

export class ProfileViewsResponse implements ProfileViewsOutput {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty() total!: number;
  @ApiProperty({ type: [CountBySlug] }) byProfile!: CountBySlug[];
  @ApiProperty({ type: [CountByLocale] }) byLocale!: CountByLocale[];
  @ApiProperty({ type: [CountByDay] }) byDay!: CountByDay[];
}

@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@UseGuards(JwtAuthGuard)
@UsePipes(adminValidationPipe)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly aggregate: AggregateProfileViewsUseCase) {}

  @Get('views')
  @ApiOperation({ summary: 'Visitas agregadas por perfil, idioma y día' })
  @ApiOkResponse({ type: ProfileViewsResponse })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async views(@Query() query: ViewsRangeQueryDto): Promise<ProfileViewsOutput> {
    const result = await this.aggregate.execute({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    if (!result.ok) throw toHttpException(result.error);
    return result.value;
  }
}
