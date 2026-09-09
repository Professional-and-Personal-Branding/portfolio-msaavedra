import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { buildRobotsTxt } from '../../application/services/sitemap.builder';
import { BuildSitemapUseCase } from '../../application/use-cases/build-sitemap.use-case';

/**
 * Archivos para buscadores (spec `public-seo`). Van fuera del prefijo `/api`
 * porque los rastreadores los buscan en la raíz del sitio; las URLs que
 * publican apuntan al frontend (`FRONTEND_URL`).
 */
@ApiExcludeController()
@SkipThrottle()
@Controller()
export class SitemapController {
  constructor(
    private readonly buildSitemap: BuildSitemapUseCase,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<AppConfig>(APP_CONFIG).frontendUrl;
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  robots(): string {
    return buildRobotsTxt(this.baseUrl);
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async sitemap(): Promise<string> {
    return (await this.buildSitemap.execute({ baseUrl: this.baseUrl })).value;
  }
}
