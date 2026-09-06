import type { Request } from 'express';
import { extractAccessToken } from './access-token.decorator';

function req(headers: Record<string, unknown> = {}, query: Record<string, unknown> = {}): Request {
  return { headers, query } as unknown as Request;
}

describe('extractAccessToken', () => {
  it('lee el header X-Access-Token', () => {
    expect(extractAccessToken(req({ 'x-access-token': 'abc' }))).toBe('abc');
  });

  it('cae al query token si no hay header', () => {
    expect(extractAccessToken(req({}, { token: 'q' }))).toBe('q');
  });

  it('el header tiene prioridad sobre el query', () => {
    expect(extractAccessToken(req({ 'x-access-token': 'h' }, { token: 'q' }))).toBe('h');
  });

  it('ausente → undefined; vacío → undefined', () => {
    expect(extractAccessToken(req())).toBeUndefined();
    expect(extractAccessToken(req({ 'x-access-token': '' }, { token: '' }))).toBeUndefined();
  });

  it('acepta arrays (primer valor)', () => {
    expect(extractAccessToken(req({ 'x-access-token': ['a', 'b'] }))).toBe('a');
  });
});
