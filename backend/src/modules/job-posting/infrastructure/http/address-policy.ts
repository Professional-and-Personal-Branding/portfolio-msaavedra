import { BlockList, isIP } from 'node:net';

/**
 * Política de direcciones (D9): ¿se puede conectar a esta IP desde el servidor? Pura y fija: no es
 * configurable ni inyectable desde el entorno. Rechaza todo lo que no es una dirección pública:
 * privadas, loopback, link-local (incluida la metadata `169.254.169.254`), CGNAT, ULA, multicast,
 * documentación y reservadas, en IPv4 e IPv6.
 */

const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, incluye la metadata de la nube
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reservado, incluye 255.255.255.255
];

/**
 * IPv6 dentro de `2000::/3`; todo lo que está fuera (`::/3`, `fc00::/7`, `fe80::/10`, `ff00::/8`…)
 * se rechaza aparte. Estos son los rangos reservados que sí caen adentro.
 */
const BLOCKED_V6: ReadonlyArray<readonly [string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['::', 96], // compatibles con IPv4
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48], // NAT64 local
  ['100::', 64], // descarte
  ['2001::', 23], // protocolo IETF: incluye Teredo y ORCHID
  ['2001:db8::', 32], // documentación
  ['2002::', 16], // 6to4
  ['3ffe::', 16], // 6bone, en desuso
  ['3fff::', 20], // documentación (RFC 9637)
  ['fc00::', 7], // ULA: incluye la red privada de Railway
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

const blockedV4 = new BlockList();
for (const [network, prefix] of BLOCKED_V4) blockedV4.addSubnet(network, prefix, 'ipv4');
const blockedV6 = new BlockList();
for (const [network, prefix] of BLOCKED_V6) blockedV6.addSubnet(network, prefix, 'ipv6');
const globalUnicastV6 = new BlockList();
globalUnicastV6.addSubnet('2000::', 3, 'ipv6');

/**
 * Las ocho palabras de 16 bits de una IPv6 (acepta `::` y una cola con punto, `::ffff:1.2.3.4`),
 * o `null` si no es una IPv6 válida.
 */
export function parseIPv6(address: string): number[] | null {
  let text = address.split('%')[0];
  if (isIP(text) !== 6) return null;

  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const octets = dotted[1].split('.').map(Number);
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    text = `${text.slice(0, dotted.index)}${high}:${low}`;
  }

  const [head, tail, extra] = text.split('::');
  if (extra !== undefined) return null;
  const headWords = head === '' ? [] : head.split(':');
  const tailWords = tail === undefined || tail === '' ? [] : tail.split(':');
  const missing = 8 - headWords.length - tailWords.length;
  if (tail === undefined ? headWords.length !== 8 : missing < 0) return null;
  const words = [
    ...headWords,
    ...Array<string>(tail === undefined ? 0 : missing).fill('0'),
    ...tailWords,
  ];
  const parsed = words.map((word) => parseInt(word, 16));
  return parsed.length === 8 && parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff)
    ? parsed
    : null;
}

/** La IPv4 de una dirección IPv4 mapeada en IPv6 (`::ffff:a.b.c.d` o `::ffff:7f00:1`), o `null`. */
export function extractMappedIPv4(address: string): string | null {
  const words = parseIPv6(address);
  if (!words) return null;
  const isMapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (!isMapped) return null;
  return [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff].join('.');
}

export function isPublicAddress(address: string): boolean {
  const ip = address.split('%')[0];
  const family = isIP(ip);
  if (family === 4) return !blockedV4.check(ip, 'ipv4');
  if (family === 6) {
    // La extracción es explícita: no se confía en cómo `BlockList` trate el mapeo.
    const mapped = extractMappedIPv4(ip);
    if (mapped !== null) return isPublicAddress(mapped);
    if (!globalUnicastV6.check(ip, 'ipv6')) return false;
    return !blockedV6.check(ip, 'ipv6');
  }
  return false;
}
