/**
 * Fallo de un proveedor ya clasificado (D9). Es una unión discriminada: el conector la devuelve
 * dentro de un `Result` y el ejecutor decide estado, reintento y pausa a partir de `kind`.
 */
export type ProviderFailure =
  | { readonly kind: 'RetryAfter'; readonly seconds: number; readonly message: string }
  | { readonly kind: 'ResetAt'; readonly at: Date; readonly message: string }
  | { readonly kind: 'Transient'; readonly message: string }
  | { readonly kind: 'Permanent'; readonly message: string }
  | { readonly kind: 'BudgetExhausted'; readonly resetAt?: Date; readonly message: string };

export type ProviderFailureKind = ProviderFailure['kind'];

export const retryAfter = (seconds: number, message: string): ProviderFailure => ({
  kind: 'RetryAfter',
  seconds,
  message,
});
export const resetAt = (at: Date, message: string): ProviderFailure => ({
  kind: 'ResetAt',
  at,
  message,
});
export const transient = (message: string): ProviderFailure => ({ kind: 'Transient', message });
export const permanent = (message: string): ProviderFailure => ({ kind: 'Permanent', message });
export const budgetExhausted = (message: string, resetAtDate?: Date): ProviderFailure =>
  resetAtDate === undefined
    ? { kind: 'BudgetExhausted', message }
    : { kind: 'BudgetExhausted', resetAt: resetAtDate, message };
