/**
 * Dobles de los e2e de `job-posting`: ningún test sale a internet. El transporte sirve los
 * fixtures por URL y registra cada petición; el resolvedor es un mapa fijo de hosts a IPs.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DnsResolver,
  HttpTransport,
  ResolvedAddress,
  TransportError,
  TransportRequest,
  TransportResponse,
} from '../../src/modules/job-posting/infrastructure/http/http-transport';

const FIXTURES = path.resolve(
  __dirname,
  '../../src/modules/job-posting/infrastructure/sources/__fixtures__',
);

export function fixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

export interface FakeRoute {
  status?: number;
  contentType?: string | null;
  location?: string | null;
  body?: string | null;
}

export class FakeHttpTransport implements HttpTransport {
  readonly requests: string[] = [];
  readonly routes = new Map<string, FakeRoute>();

  reset(): void {
    this.requests.length = 0;
    this.routes.clear();
  }

  json(url: string, body: string): void {
    this.routes.set(url, { contentType: 'application/json; charset=utf-8', body });
  }

  html(url: string, body: string): void {
    this.routes.set(url, { contentType: 'text/html; charset=utf-8', body });
  }

  redirect(url: string, location: string, status = 301): void {
    this.routes.set(url, { status, location });
  }

  get(request: TransportRequest): Promise<TransportResponse> {
    this.requests.push(request.url.href);
    const route = this.routes.get(request.url.href);
    if (!route) return Promise.reject(new TransportError('network', 'sin ruta en el e2e'));
    const status = route.status ?? 200;
    const contentType = route.contentType ?? null;
    const read = request.shouldReadBody(status, contentType);
    return Promise.resolve({
      status,
      contentType,
      location: route.location ?? null,
      body: read ? (route.body ?? '') : null,
    });
  }
}

export class FakeDnsResolver implements DnsResolver {
  /** Cualquier host sin entrada resuelve a una IP pública de ejemplo. */
  readonly hosts = new Map<string, ResolvedAddress[]>();
  readonly resolved: string[] = [];

  resolve(hostname: string): Promise<ResolvedAddress[]> {
    this.resolved.push(hostname);
    return Promise.resolve(this.hosts.get(hostname) ?? [{ address: '93.184.216.34', family: 4 }]);
  }
}

/** Reloj desplazable para el caso de la purga a los 90 días. */
export class OffsetClock {
  offsetMs = 0;
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
}
