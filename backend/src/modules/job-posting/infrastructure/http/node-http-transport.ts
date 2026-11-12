import * as http from 'node:http';
import * as https from 'node:https';
import { LookupFunction } from 'node:net';
import { Readable } from 'node:stream';
import * as zlib from 'node:zlib';
import {
  HttpTransport,
  TransportError,
  TransportRequest,
  TransportResponse,
} from './http-transport';

/** Inactividad máxima del socket (D9); el plazo total lo pone el `AbortSignal` de la importación. */
export const SOCKET_TIMEOUT_MS = 5000;

export const USER_AGENT = 'PortfolioJobIntake/1.0';

export interface NodeHttpTransportOptions {
  /** `lookup` propio para los tests del transporte (`acme.test` → `127.0.0.1`). */
  readonly lookup?: LookupFunction;
  readonly socketTimeoutMs?: number;
}

/** `lookup` que entrega siempre la IP ya validada, en la forma que pida Node (`all` o única). */
function pinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      (callback as (e: null, a: Array<{ address: string; family: number }>) => void)(null, [
        { address, family },
      ]);
    } else {
      callback(null, address, family);
    }
  };
}

function headerValue(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Transporte real sobre `node:http(s)` sin dependencias (D9). Solo `GET`, solo las cabeceras
 * `Accept`, `Accept-Encoding`, `Accept-Language` y `User-Agent` (nunca `Cookie`, `Authorization`
 * ni cabeceras de la petición entrante), sin agente con keep-alive compartido. El certificado TLS
 * se valida contra el nombre del host. Descomprime gzip/deflate y cuenta los bytes **después de
 * descomprimir**, así una bomba de compresión corta al pasar el tope.
 */
export class NodeHttpTransport implements HttpTransport {
  private readonly lookupOverride: LookupFunction | undefined;
  private readonly socketTimeoutMs: number;

  constructor(options: NodeHttpTransportOptions = {}) {
    this.lookupOverride = options.lookup;
    this.socketTimeoutMs = options.socketTimeoutMs ?? SOCKET_TIMEOUT_MS;
  }

  get(request: TransportRequest): Promise<TransportResponse> {
    return new Promise<TransportResponse>((resolve, reject) => {
      const { url, signal } = request;
      if (signal.aborted) {
        reject(new TransportError('timeout', 'plazo vencido'));
        return;
      }

      let settled = false;
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        action();
      };
      const lookup = request.address
        ? pinnedLookup(request.address, request.address.includes(':') ? 6 : 4)
        : this.lookupOverride;

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port === '' ? undefined : Number(url.port),
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          headers: {
            Accept: request.accept,
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'es, en;q=0.8',
            'User-Agent': USER_AGENT,
            Connection: 'close',
          },
          // Sin agente compartido ni keep-alive.
          agent: false,
          lookup,
          signal,
        },
        (res) => {
          const status = res.statusCode ?? 0;
          const contentType = headerValue(res.headers['content-type']);
          const location = headerValue(res.headers.location);
          // Los `Set-Cookie` se ignoran: nunca se leen ni se guardan.

          if (!request.shouldReadBody(status, contentType)) {
            res.destroy();
            finish(() => resolve({ status, contentType, location, body: null }));
            return;
          }

          const declared = Number(headerValue(res.headers['content-length']));
          if (Number.isFinite(declared) && declared > request.maxBytes) {
            res.destroy();
            req.destroy();
            finish(() => reject(new TransportError('too-large', 'Content-Length sobre el tope')));
            return;
          }

          const encoding = (
            headerValue(res.headers['content-encoding']) ?? 'identity'
          ).toLowerCase();
          let source: Readable = res;
          if (encoding === 'gzip' || encoding === 'x-gzip') {
            source = res.pipe(zlib.createGunzip());
          } else if (encoding === 'deflate') {
            source = res.pipe(zlib.createInflate());
          } else if (encoding !== 'identity') {
            res.destroy();
            finish(() => reject(new TransportError('network', 'codificación no soportada')));
            return;
          }

          const chunks: Buffer[] = [];
          let total = 0;
          source.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > request.maxBytes) {
              source.destroy();
              res.destroy();
              req.destroy();
              finish(() => reject(new TransportError('too-large', 'cuerpo sobre el tope')));
              return;
            }
            chunks.push(chunk);
          });
          source.on('end', () =>
            finish(() =>
              resolve({
                status,
                contentType,
                location,
                body: Buffer.concat(chunks).toString('utf8'),
              }),
            ),
          );
          const readFailed = (): void =>
            finish(() =>
              reject(
                signal.aborted
                  ? new TransportError('timeout', 'plazo vencido')
                  : new TransportError('network', 'error al leer la respuesta'),
              ),
            );
          source.on('error', readFailed);
          res.on('error', readFailed);
        },
      );

      req.setTimeout(this.socketTimeoutMs, () => {
        req.destroy();
        finish(() => reject(new TransportError('timeout', 'socket inactivo')));
      });
      req.on('error', () => {
        finish(() =>
          reject(
            signal.aborted
              ? new TransportError('timeout', 'plazo vencido')
              : new TransportError('network', 'no se pudo conectar'),
          ),
        );
      });
      req.end();
    });
  }
}
