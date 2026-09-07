export const TOKEN_SIGNER = Symbol('TokenSigner');

export interface TokenClaims {
  /** Id del administrador. */
  readonly sub: string;
  readonly email: string;
  readonly name: string;
}

export interface SignedToken {
  readonly token: string;
  readonly expiresInSeconds: number;
}

/** Puerto de emisión de tokens (implementación: JWT HS256 en infraestructura). */
export interface TokenSigner {
  sign(claims: TokenClaims): Promise<SignedToken>;
}
