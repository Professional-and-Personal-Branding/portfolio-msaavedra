/**
 * `npm run ai:eval [-- --task <id>] [-- --record] [-- --max-usd <n>]` (change `add-ai-foundation`, D17).
 *
 * Corre las evals de las tareas de IA contra la API REAL de Anthropic, con un presupuesto EN MEMORIA
 * (no toca la base ni el ledger de la app) y solo con los datos ficticios de `docs/examples/`.
 * Gasta dinero: se NIEGA (código 2), sin ninguna llamada facturable, si falta `AI_EVAL_API_KEY` (la
 * clave del workspace de evals de la Console, que NO es `ANTHROPIC_API_KEY`), si falta
 * `AI_EVAL_ALLOW_SPEND=1` o si la suma de las reservas supera el tope de la corrida
 * (`--max-usd` o `AI_EVAL_MAX_USD`, 2 USD por defecto).
 *
 * Uso típico, en el workspace de evals con su spend limit de 5 USD:
 *   AI_EVAL_API_KEY=... AI_EVAL_ALLOW_SPEND=1 npm run ai:eval -- --task ai.smoke --max-usd 1
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { runAiEvalCli } from '../src/modules/ai/evals/ai-eval.cli';
import { createAnthropicClient } from '../src/modules/ai/infrastructure/anthropic/anthropic-client.factory';
import { AnthropicLlmAdapter } from '../src/modules/ai/infrastructure/anthropic/anthropic-llm.adapter';

const TIMEOUT_MS = 60_000;

function sdkVersion(): string {
  const file = join(__dirname, '..', 'node_modules', '@anthropic-ai', 'sdk', 'package.json');
  return (JSON.parse(readFileSync(file, 'utf-8')) as { version: string }).version;
}

runAiEvalCli(process.argv.slice(2), {
  env: process.env,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
  createLlm: (apiKey, onResponse) =>
    new AnthropicLlmAdapter(createAnthropicClient({ apiKey, timeoutMs: TIMEOUT_MS }), {
      timeoutMs: TIMEOUT_MS,
      knownSecrets: [apiKey],
      onResponse,
    }),
  writeFile: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf-8');
  },
  cassettesDir: join(__dirname, '..', 'test', 'fixtures', 'ai', 'cassettes'),
  sdkVersion: sdkVersion(),
})
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error('ai:eval falló:', error instanceof Error ? error.message : 'error inesperado');
    process.exit(1);
  });
