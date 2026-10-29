import { createHash } from 'crypto';
import {
  BOT_USER_AGENT_PATTERNS,
  BOT_USER_AGENT_PATTERNS_VERSION,
  classifyUserAgent,
} from './classify-user-agent';

/** Un UA real (o muy cercano al real) por cada token de la lista. */
const REAL_BOT_USER_AGENTS: Record<string, string> = {
  Googlebot:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Google-InspectionTool': 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)',
  GoogleOther: 'Mozilla/5.0 (compatible; GoogleOther)',
  'Storebot-Google':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; Storebot-Google/1.0)',
  'AdsBot-Google': 'Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)',
  'Mediapartners-Google': 'Mediapartners-Google',
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  BingPreview:
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534+ (KHTML, like Gecko) BingPreview/1.0b',
  Applebot:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  DuckDuckBot: 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  YandexBot: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  Baiduspider:
    'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
  PetalBot:
    'Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)',
  HeadlessChrome:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
  'Chrome-Lighthouse':
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
  Lighthouse: 'Mozilla/5.0 (compatible; Lighthouse)',
  PTST: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 PTST/240101',
  PortfolioCheck:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PortfolioCheck',
  AhrefsBot: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  SemrushBot: 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  MJ12bot: 'Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)',
  DotBot:
    'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot; help@moz.com)',
  GPTBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot',
  ClaudeBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  PerplexityBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  Bytespider:
    'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  CCBot: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  LinkedInBot:
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  Slackbot: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  Twitterbot: 'Twitterbot/1.0',
  facebookexternalhit: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  WhatsApp: 'WhatsApp/2.23.20.0 A',
  TelegramBot: 'TelegramBot (like TwitterBot)',
  Discordbot: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  UptimeRobot: 'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
  Pingdom: 'Pingdom.com_bot_version_1.4_(http://www.pingdom.com/)',
  StatusCake: 'Mozilla/5.0 (compatible; StatusCake)',
  'curl/': 'curl/8.4.0',
  'Wget/': 'Wget/1.21.4',
  'python-requests': 'python-requests/2.31.0',
  'python-httpx': 'python-httpx/0.25.2',
  aiohttp: 'Python/3.11 aiohttp/3.9.1',
  'node-fetch': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
  'axios/': 'axios/1.6.2',
  undici: 'undici',
  'Go-http-client': 'Go-http-client/2.0',
  okhttp: 'okhttp/4.12.0',
  'Java/': 'Java/17.0.9',
  'libwww-perl': 'libwww-perl/6.72',
  PostmanRuntime: 'PostmanRuntime/7.36.0',
  insomnia: 'insomnia/8.4.5',
};

const REAL_BROWSER_USER_AGENTS: [string, string][] = [
  [
    'Chrome de escritorio',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ],
  [
    'Firefox de escritorio',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ],
  [
    'Safari de escritorio',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  ],
  [
    'Chrome Android',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ],
  [
    'Safari iOS',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  ],
  [
    'Edge',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  ],
];

const NOT_A_BOT: [string, string][] = [
  ['TestUA de los tests', 'TestUA'],
  ['el seed de ejemplo', 'example-seed'],
  ['el e2e de segundo plano', 'BackgroundViewsE2E'],
  [
    'un Android de la marca Cubot',
    'Mozilla/5.0 (Linux; Android 11; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ],
  [
    'robot dentro de una palabra',
    'Mozilla/5.0 (Linux; Android 10; Robotics Tab) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  ],
  ['javascript/ no es Java/', 'Mozilla/5.0 javascript/1.0 compatible-browser'],
];

describe('classifyUserAgent', () => {
  const allTokens = Object.values(BOT_USER_AGENT_PATTERNS).flat();

  it('hay un UA real por cada token de la lista (y ninguno de más)', () => {
    expect(Object.keys(REAL_BOT_USER_AGENTS).sort()).toEqual([...allTokens].sort());
  });

  it.each(Object.entries(REAL_BOT_USER_AGENTS))('%s -> BOT', (_token, ua) => {
    expect(classifyUserAgent(ua)).toBe('BOT');
  });

  it.each(REAL_BROWSER_USER_AGENTS)('%s -> HUMAN', (_name, ua) => {
    expect(classifyUserAgent(ua)).toBe('HUMAN');
  });

  it.each(NOT_A_BOT)('%s -> HUMAN (sin falsos positivos)', (_name, ua) => {
    expect(classifyUserAgent(ua)).toBe('HUMAN');
  });

  it.each([undefined, null, '', '   '])('UA ausente o vacío (%j) -> BOT', (ua) => {
    expect(classifyUserAgent(ua)).toBe('BOT');
  });

  it('no distingue mayúsculas', () => {
    expect(classifyUserAgent('Mozilla/5.0 HEADLESSCHROME/120')).toBe('BOT');
    expect(classifyUserAgent('mozilla/5.0 googlebot/2.1')).toBe('BOT');
  });

  it('la lista cambió sin subir la versión: actualizá BOT_USER_AGENT_PATTERNS_VERSION y este hash', () => {
    // Todo cambio de la lista sube la versión y suma un caso de prueba (spec).
    const hash = createHash('sha256').update(JSON.stringify(BOT_USER_AGENT_PATTERNS)).digest('hex');
    const registered: Record<number, string> = {
      1: 'bf3d5aad030f7c78faa9dc4285840fb8e81861c8f3bf6d85a165c9e0a17a7755',
    };
    expect(registered[BOT_USER_AGENT_PATTERNS_VERSION]).toBe(hash);
  });
});
