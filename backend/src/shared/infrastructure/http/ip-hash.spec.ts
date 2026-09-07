import { hashIp } from './ip-hash';

describe('hashIp', () => {
  it('produce 64 hex, determinista por sal, sin la IP en claro', () => {
    const h = hashIp('203.0.113.7', 'salt-a');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashIp('203.0.113.7', 'salt-a'));
    expect(h).not.toBe(hashIp('203.0.113.7', 'salt-b'));
    expect(h).not.toContain('203.0.113.7');
  });

  it('undefined sin IP', () => {
    expect(hashIp(undefined, 's')).toBeUndefined();
    expect(hashIp('', 's')).toBeUndefined();
  });
});
