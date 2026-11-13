import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { DnsResolver, ResolvedAddress } from './http-transport';

/** Resolución del sistema: todas las direcciones del nombre, en el orden del resolvedor. */
@Injectable()
export class SystemDnsResolver implements DnsResolver {
  async resolve(hostname: string): Promise<ResolvedAddress[]> {
    const found = await lookup(hostname, { all: true, verbatim: true });
    return found.map((entry) => ({ address: entry.address, family: entry.family === 6 ? 6 : 4 }));
  }
}
