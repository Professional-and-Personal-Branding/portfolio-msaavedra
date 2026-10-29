/**
 * Clasificador de `User-Agent` (spec `profile-view-analytics`, D3). Función pura
 * sobre una lista de tokens literales versionada en el repositorio: no hay
 * dependencias externas ni regex genéricos (`bot|crawler`) que marquen como bot a
 * un teléfono Cubot. Todo cambio de la lista sube la versión (un test lo exige) y
 * después se corre `npm run views:reclassify` para recalcular las filas viejas.
 */
export const BOT_USER_AGENT_PATTERNS_VERSION = 1;

export const BOT_USER_AGENT_PATTERNS = {
  /** Buscadores que renderizan la SPA y disparan la misma petición que un navegador. */
  buscadoresConJs: [
    'Googlebot',
    'Google-InspectionTool',
    'GoogleOther',
    'Storebot-Google',
    'AdsBot-Google',
    'Mediapartners-Google',
    'bingbot',
    'BingPreview',
    'Applebot',
    'DuckDuckBot',
    'YandexBot',
    'Baiduspider',
    'PetalBot',
  ],
  /** Navegadores automatizados y herramientas de medición (los scripts de calidad). */
  automatizadosYMedicion: [
    'HeadlessChrome',
    'Chrome-Lighthouse',
    'Lighthouse',
    'PTST',
    'PortfolioCheck',
  ],
  /** Crawlers de SEO y de IA. */
  crawlersSeoEIa: [
    'AhrefsBot',
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'GPTBot',
    'ClaudeBot',
    'PerplexityBot',
    'Bytespider',
    'CCBot',
  ],
  /** Previsualizadores de enlaces (hoy no llegan a la API, pero si llegan no son personas). */
  previsualizadores: [
    'LinkedInBot',
    'Slackbot',
    'Twitterbot',
    'facebookexternalhit',
    'WhatsApp',
    'TelegramBot',
    'Discordbot',
  ],
  monitoreo: ['UptimeRobot', 'Pingdom', 'StatusCake'],
  /** Clientes programáticos: ninguna persona llega a la API sin un navegador. */
  clientesProgramaticos: [
    'curl/',
    'Wget/',
    'python-requests',
    'python-httpx',
    'aiohttp',
    'node-fetch',
    'axios/',
    'undici',
    'Go-http-client',
    'okhttp',
    'Java/',
    'libwww-perl',
    'PostmanRuntime',
    'insomnia',
  ],
} as const;

/** Lista plana, en minúsculas, lista para comparar como subcadena. */
const FLAT_PATTERNS: readonly string[] = Object.values(BOT_USER_AGENT_PATTERNS)
  .flat()
  .map((token) => token.toLowerCase());

/**
 * `BOT` si el UA falta, está vacío o contiene algún token de la lista (sin
 * distinguir mayúsculas); `HUMAN` en cualquier otro caso. Ningún navegador
 * omite el header, por eso la ausencia cuenta como bot.
 */
export function classifyUserAgent(userAgent: string | null | undefined): 'BOT' | 'HUMAN' {
  const normalized = userAgent?.trim().toLowerCase();
  if (!normalized) return 'BOT';
  return FLAT_PATTERNS.some((token) => normalized.includes(token)) ? 'BOT' : 'HUMAN';
}
