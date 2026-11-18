/** Escenarios del proveedor `fake` (`AI_FAKE_SCENARIO`, D20). */
export const AI_FAKE_SCENARIOS = [
  'ok',
  'refusal',
  'truncated',
  'invalid-output',
  'transient',
  'spend-limit-tier',
  'spend-limit-console',
  'slow',
] as const;

export type AiFakeScenario = (typeof AI_FAKE_SCENARIOS)[number];

export function isFakeScenario(value: string): value is AiFakeScenario {
  return (AI_FAKE_SCENARIOS as readonly string[]).includes(value);
}
