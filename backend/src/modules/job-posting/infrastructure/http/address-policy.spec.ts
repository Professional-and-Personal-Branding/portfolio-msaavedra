import { extractMappedIPv4, isPublicAddress, parseIPv6 } from './address-policy';

/** Primer y último valor de cada rango bloqueado de D9 (IPv4). */
const BLOCKED_V4_RANGES: Array<[string, string, string]> = [
  ['0.0.0.0/8', '0.0.0.0', '0.255.255.255'],
  ['10.0.0.0/8', '10.0.0.0', '10.255.255.255'],
  ['100.64.0.0/10', '100.64.0.0', '100.127.255.255'],
  ['127.0.0.0/8', '127.0.0.0', '127.255.255.255'],
  ['169.254.0.0/16', '169.254.0.0', '169.254.255.255'],
  ['172.16.0.0/12', '172.16.0.0', '172.31.255.255'],
  ['192.0.0.0/24', '192.0.0.0', '192.0.0.255'],
  ['192.0.2.0/24', '192.0.2.0', '192.0.2.255'],
  ['192.88.99.0/24', '192.88.99.0', '192.88.99.255'],
  ['192.168.0.0/16', '192.168.0.0', '192.168.255.255'],
  ['198.18.0.0/15', '198.18.0.0', '198.19.255.255'],
  ['198.51.100.0/24', '198.51.100.0', '198.51.100.255'],
  ['203.0.113.0/24', '203.0.113.0', '203.0.113.255'],
  ['224.0.0.0/4', '224.0.0.0', '239.255.255.255'],
  ['240.0.0.0/4', '240.0.0.0', '255.255.255.255'],
];

/** Vecinos públicos inmediatos de esos rangos. */
const PUBLIC_V4_NEIGHBORS = [
  '1.1.1.1',
  '8.8.8.8',
  '9.255.255.255',
  '11.0.0.0',
  '100.63.255.255',
  '100.128.0.0',
  '126.255.255.255',
  '128.0.0.0',
  '169.253.255.255',
  '169.255.0.0',
  '172.15.255.255',
  '172.32.0.0',
  '192.0.1.0',
  '192.88.98.255',
  '192.88.100.0',
  '192.167.255.255',
  '192.169.0.0',
  '198.17.255.255',
  '198.20.0.0',
  '198.51.99.255',
  '198.51.101.0',
  '203.0.112.255',
  '203.0.114.0',
  '223.255.255.255',
  '93.184.216.34',
];

describe('isPublicAddress — IPv4 (D9)', () => {
  it.each(BLOCKED_V4_RANGES)('rechaza el primer y el último valor de %s', (_range, first, last) => {
    expect(isPublicAddress(first)).toBe(false);
    expect(isPublicAddress(last)).toBe(false);
  });

  it.each(PUBLIC_V4_NEIGHBORS)('acepta %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it('rechaza la metadata de la nube', () => {
    expect(isPublicAddress('169.254.169.254')).toBe(false);
  });
});

describe('isPublicAddress — IPv6 (D9)', () => {
  const blocked = [
    '::',
    '::1',
    '::2',
    '::ffff:0:0', // ::/96 vecino: mapeada a 0.0.0.0
    '::7f00:1', // compatible con IPv4 (::/96)
    '64:ff9b::',
    '64:ff9b::a00:1',
    '64:ff9b::ffff:ffff',
    '64:ff9b:1::1',
    '64:ff9b:1:ffff:ffff:ffff:ffff:ffff',
    '100::',
    '100::ffff:ffff:ffff:ffff',
    '2001::',
    '2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:db8::',
    '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff',
    '2002::',
    '2002:c0a8:0101::1',
    '2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'fc00::',
    'fd12:3456::1',
    'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'fe80::',
    'fe80::1',
    'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'fec0::1',
    'ff00::',
    'ff02::1',
    'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    '3ffe::1',
    '3fff::1',
    '3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff',
    '1000::1', // fuera de 2000::/3
    'fe80::1%eth0',
  ];

  it.each(blocked)('rechaza %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['2606:4700::1111', '2a00:1450:4001:81b::200e', '2001:4860:4860::8888', '2003::1'])(
    'acepta %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it('IPv4 mapeadas: se evalúa la IPv4 de adentro', () => {
    expect(isPublicAddress('::ffff:169.254.169.254')).toBe(false);
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('::ffff:10.0.0.5')).toBe(false);
    expect(isPublicAddress('::ffff:a9fe:a9fe')).toBe(false);
    expect(isPublicAddress('0:0:0:0:0:ffff:c0a8:0101')).toBe(false);
    expect(isPublicAddress('::FFFF:192.168.1.10')).toBe(false);
    expect(isPublicAddress('::ffff:93.184.216.34')).toBe(true);
    expect(isPublicAddress('::ffff:5db8:d822')).toBe(true);
  });

  it('lo que no es una IP se rechaza', () => {
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
    expect(isPublicAddress('999.1.1.1')).toBe(false);
    expect(isPublicAddress('93.184.216.34.5')).toBe(false);
  });
});

describe('parseIPv6 y extractMappedIPv4', () => {
  it('expande :: y la cola con punto', () => {
    expect(parseIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIPv6('::ffff:1.2.3.4')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
    expect(parseIPv6('2001:db8::8:800:200c:417a')).toEqual([
      0x2001, 0x0db8, 0, 0, 0x0008, 0x0800, 0x200c, 0x417a,
    ]);
    expect(parseIPv6('1.2.3.4')).toBeNull();
  });

  it('extrae la IPv4 mapeada y nada más', () => {
    expect(extractMappedIPv4('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(extractMappedIPv4('::ffff:0102:0304')).toBe('1.2.3.4');
    expect(extractMappedIPv4('::1.2.3.4')).toBeNull();
    expect(extractMappedIPv4('2606:4700::1111')).toBeNull();
  });
});
