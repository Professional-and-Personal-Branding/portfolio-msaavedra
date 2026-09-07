/**
 * Token de acceso de un perfil PROTECTED. La comparación es en tiempo constante
 * (sin depender de node:crypto para mantener el dominio puro).
 */
export class AccessToken {
  private constructor(private readonly tokenValue: string | null) {}

  static create(value: string | null | undefined): AccessToken {
    const trimmed = value?.trim();
    return new AccessToken(trimmed ? trimmed : null);
  }

  static none(): AccessToken {
    return new AccessToken(null);
  }

  get isSet(): boolean {
    return this.tokenValue !== null;
  }

  /** Valor crudo, solo para persistencia y backoffice. Nunca sale por rutas públicas. */
  get value(): string | null {
    return this.tokenValue;
  }

  /** true solo si hay token configurado y el candidato coincide exactamente. */
  matches(candidate: string | null | undefined): boolean {
    if (this.tokenValue === null || !candidate) return false;
    return constantTimeEquals(this.tokenValue, candidate);
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
