/**
 * Puertos de bajo nivel del cliente HTTP seguro (D9). `HttpTransport` solo transporta (conexión,
 * tope de bytes tras descomprimir, plazo); no aplica ninguna política: la política de URL, de
 * portales cerrados, de redirects y de direcciones la aplica `SafeHttpClient`. `DnsResolver`
 * resuelve un nombre a todas sus direcciones, para que `SafeHttpClient` las valide.
 */

export const HTTP_TRANSPORT = Symbol('HttpTransport');
export const DNS_RESOLVER = Symbol('DnsResolver');

export interface ResolvedAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

export interface DnsResolver {
  resolve(hostname: string): Promise<ResolvedAddress[]>;
}

export interface TransportRequest {
  readonly url: URL;
  /**
   * IP ya validada a la que conectar. El socket usa esta misma dirección y la validación no se
   * repite al conectar: no hay ventana entre chequear y usar (DNS rebinding). `null`: el
   * transporte resuelve con su propio `lookup` (solo en los tests del transporte).
   */
  readonly address: string | null;
  readonly accept: string;
  readonly maxBytes: number;
  readonly signal: AbortSignal;
  /** Decide si se lee el cuerpo; si no, se corta la respuesta tras las cabeceras. */
  readonly shouldReadBody: (status: number, contentType: string | null) => boolean;
}

export interface TransportResponse {
  readonly status: number;
  readonly contentType: string | null;
  readonly location: string | null;
  /** `null` si `shouldReadBody` dijo que no. */
  readonly body: string | null;
}

export type TransportFailureKind = 'timeout' | 'too-large' | 'network';

export class TransportError extends Error {
  constructor(
    readonly kind: TransportFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface HttpTransport {
  /** Rechaza con `TransportError`. Nunca sigue redirects. */
  get(request: TransportRequest): Promise<TransportResponse>;
}
