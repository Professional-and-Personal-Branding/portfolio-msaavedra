import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  SafeHttpClient,
  SafeHttpGetOptions,
  SafeHttpResponse,
} from '../../application/ports/job-posting-source';
import { classifyClosedPortal, closedPortalMessage } from '../../domain/closed-portals';
import { ImportFailure } from '../../domain/errors/import-failure';
import { checkUrlPolicy } from '../../domain/services/check-url-policy';
import { isPublicAddress } from './address-policy';
import {
  DNS_RESOLVER,
  DnsResolver,
  HTTP_TRANSPORT,
  HttpTransport,
  ResolvedAddress,
  TransportError,
  TransportResponse,
} from './http-transport';

/** Redirects que se siguen como máximo (D8); el cuarto es un 422. */
export const MAX_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const ACCEPT_HEADERS = {
  html: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
  json: 'application/json',
} as const;

const ALLOWED_CONTENT_TYPES = {
  html: ['text/html', 'application/xhtml+xml'],
  json: ['application/json'],
} as const;

function mediaType(contentType: string | null): string {
  return (contentType ?? '').split(';')[0].trim().toLowerCase();
}

/** Rechaza `promise` apenas el plazo de la importación vence, aunque la operación siga abierta. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new TransportError('timeout', 'plazo vencido'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new TransportError('timeout', 'plazo vencido'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Cliente HTTP seguro (D7–D10): aplica la política de URL (D7), los portales cerrados (D5), los
 * redirects a mano (D8), la validación de direcciones (D9) y la clasificación de errores (D16)
 * sobre un `HttpTransport` y un `DnsResolver` inyectados. La política de direcciones es fija
 * (`isPublicAddress`): no se configura ni se inyecta desde el entorno.
 *
 * Los errores nunca llevan el cuerpo remoto ni la IP resuelta.
 */
@Injectable()
export class DefaultSafeHttpClient implements SafeHttpClient {
  constructor(
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransport,
    @Inject(DNS_RESOLVER) private readonly resolver: DnsResolver,
  ) {}

  async get(
    start: URL,
    options: SafeHttpGetOptions,
  ): Promise<Result<SafeHttpResponse, ImportFailure>> {
    let current = start;
    let redirects = 0;

    for (;;) {
      // Cada salto —el primero también— pasa por D7, D5 y D9 antes de abrir un socket.
      const guarded = this.guardUrl(current);
      if (!guarded.ok) return guarded;

      const address = await this.pickAddress(current.hostname, options.signal);
      if (!address.ok) return address;

      let response: TransportResponse;
      try {
        response = await this.transport.get({
          url: current,
          address: address.value.address,
          accept: ACCEPT_HEADERS[options.accept],
          maxBytes: options.maxBytes,
          signal: options.signal,
          shouldReadBody: (status, contentType) =>
            status >= 200 &&
            status < 300 &&
            (ALLOWED_CONTENT_TYPES[options.accept] as readonly string[]).includes(
              mediaType(contentType),
            ),
        });
      } catch (error) {
        return fail(this.fromTransportError(error));
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        if (redirects >= MAX_REDIRECTS) {
          return fail(
            ImportFailure.withHint('too-many-redirects', 'La página redirige demasiadas veces'),
          );
        }
        redirects += 1;
        if (response.location === null || response.location === '') {
          return fail(ImportFailure.withHint('upstream-error', 'La página respondió con un error'));
        }
        try {
          current = new URL(response.location, current);
        } catch {
          return fail(ImportFailure.withHint('upstream-error', 'La página respondió con un error'));
        }
        continue;
      }

      if (response.status === 404 || response.status === 410) {
        return fail(
          ImportFailure.withHint('not-found', 'No encontramos esa vacante (puede estar cerrada)'),
        );
      }
      if (response.status < 200 || response.status >= 300) {
        return fail(ImportFailure.withHint('upstream-error', 'La página respondió con un error'));
      }
      if (response.body === null) {
        return fail(
          ImportFailure.withHint(
            'unexpected-content-type',
            'La URL no devuelve una página de vacante',
          ),
        );
      }
      return ok({ url: current, body: response.body });
    }
  }

  /** D7 + D5 sobre una URL (la pedida o la de un redirect). */
  private guardUrl(url: URL): Result<URL, ImportFailure> {
    const policy = checkUrlPolicy(url.href);
    if (!policy.ok) return policy;
    const portal = classifyClosedPortal(policy.value.hostname);
    if (portal) return fail(new ImportFailure('closed-portal', closedPortalMessage(portal)));
    return policy;
  }

  /**
   * Resuelve el nombre y exige que **todas** las direcciones sean públicas (D9). Devuelve la
   * primera —prefiriendo IPv4, que no depende de que el servidor tenga ruta IPv6—: es la IP a la
   * que conecta el socket.
   */
  private async pickAddress(
    hostname: string,
    signal: AbortSignal,
  ): Promise<Result<ResolvedAddress, ImportFailure>> {
    let addresses: ResolvedAddress[];
    try {
      addresses = await raceAbort(this.resolver.resolve(hostname.replace(/\.$/, '')), signal);
    } catch (error) {
      return fail(this.fromTransportError(error));
    }
    if (addresses.length === 0) {
      return fail(ImportFailure.withHint('upstream-error', 'No pudimos conectar con esa página'));
    }
    if (!addresses.every((entry) => isPublicAddress(entry.address))) {
      return fail(
        ImportFailure.withHint(
          'blocked-address',
          'La URL apunta a una dirección que no está permitida',
        ),
      );
    }
    return ok(addresses.find((entry) => entry.family === 4) ?? addresses[0]);
  }

  private fromTransportError(error: unknown): ImportFailure {
    if (error instanceof TransportError) {
      if (error.kind === 'timeout') {
        return ImportFailure.withHint('timeout', 'La página tardó demasiado en responder');
      }
      if (error.kind === 'too-large') {
        return ImportFailure.withHint('too-large', 'La página es demasiado grande');
      }
    }
    return ImportFailure.withHint('upstream-error', 'No pudimos conectar con esa página');
  }
}
