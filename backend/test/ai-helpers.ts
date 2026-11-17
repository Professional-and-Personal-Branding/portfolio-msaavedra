/**
 * Utilidades de los e2e de la base de IA (change `add-ai-foundation`): arma la app con el proveedor
 * `fake` (o la IA apagada) sin dejar variables `AI_*` colgadas para los demás e2e, y espía el
 * adaptador para comprobar qué recibe. Ningún e2e llama a Anthropic ni usa una clave real.
 */
import { INestApplication } from '@nestjs/common';
import { LLM_PORT, LlmPort } from '../src/modules/ai/application/ports/llm.port';
import { ANTHROPIC_CLIENT_FACTORY } from '../src/modules/ai/infrastructure/anthropic/anthropic-client.factory';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createTestApp } from './e2e-helpers';

const MANAGED = [
  'AI_ENABLED',
  'AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'AI_MONTHLY_BUDGET_USD',
  'AI_REQUEST_TIMEOUT_MS',
  'AI_MAX_CONCURRENCY',
  'AI_MAX_INPUT_TOKENS',
  'AI_FAKE_SCENARIO',
];

export interface AiTestApp {
  app: INestApplication;
  prisma: PrismaService;
  llm: LlmPort;
  /** Espías sobre el adaptador (llaman al original). */
  completeSpy: jest.SpyInstance;
  countSpy: jest.SpyInstance;
  /** Doble de la factory del cliente del SDK: no debería invocarse nunca en estos e2e. */
  clientFactory: jest.Mock;
  close: () => Promise<void>;
}

/** Arma la app con estas variables `AI_*` y las restaura enseguida (la config se lee al compilar). */
export async function createAiApp(env: Record<string, string | undefined>): Promise<AiTestApp> {
  const previous = new Map(MANAGED.map((name) => [name, process.env[name]]));
  for (const name of MANAGED) delete process.env[name];
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined) process.env[name] = value;
  }
  const clientFactory = jest.fn();
  try {
    const { app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(ANTHROPIC_CLIENT_FACTORY).useValue(clientFactory),
    );
    const llm = app.get<LlmPort>(LLM_PORT);
    return {
      app,
      prisma,
      llm,
      completeSpy: jest.spyOn(llm, 'complete'),
      countSpy: jest.spyOn(llm, 'countInputTokens'),
      clientFactory,
      close: () => app.close(),
    };
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** Borra las corridas y contadores de IA (la base de e2e es descartable). */
export async function cleanAi(prisma: PrismaService): Promise<void> {
  await prisma.aiRun.deleteMany({});
  await prisma.aiBudgetMonth.deleteMany({});
}
