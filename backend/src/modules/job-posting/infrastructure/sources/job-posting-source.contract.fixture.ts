import * as fs from 'node:fs';
import * as path from 'node:path';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  JobPostingSource,
  SafeHttpClient,
  SafeHttpGetOptions,
  SafeHttpResponse,
} from '../../application/ports/job-posting-source';
import { ImportFailure } from '../../domain/errors/import-failure';

export function readFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
}

/** `SafeHttpClient` falso: responde por URL exacta y registra lo pedido. */
export class FakeSafeHttpClient implements SafeHttpClient {
  readonly requested: Array<{ url: string; options: SafeHttpGetOptions }> = [];

  constructor(private readonly bodies: Record<string, string | ImportFailure>) {}

  get(url: URL, options: SafeHttpGetOptions): Promise<Result<SafeHttpResponse, ImportFailure>> {
    this.requested.push({ url: url.href, options });
    const body = this.bodies[url.href];
    if (body === undefined) return Promise.reject(new Error(`sin fixture para ${url.href}`));
    return Promise.resolve(typeof body === 'string' ? ok({ url, body }) : fail(body));
  }
}

export interface SourceContractCase {
  readonly name: string;
  /** URL que el owner pega. */
  readonly url: string;
  /** Respuestas del `SafeHttpClient` falso por URL (la de la API o la de la página). */
  readonly responses: Record<string, string>;
}

const MAX_DESCRIPTION = 20_000;

/**
 * Suite de contrato de toda fuente (D22): título no vacío, `applyUrl` https o nulo, `sourceKey`
 * estable entre dos lecturas, descripción de a lo sumo 20 000 caracteres y sin etiquetas HTML.
 */
export function describeJobPostingSourceContract(
  name: string,
  factory: (client: SafeHttpClient) => JobPostingSource,
  cases: readonly SourceContractCase[],
): void {
  describe(`contrato de fuente: ${name}`, () => {
    it.each(cases.map((c) => [c.name, c] as const))('%s', async (_label, testCase) => {
      const source = factory(new FakeSafeHttpClient(testCase.responses));
      const url = new URL(testCase.url);
      expect(source.canHandle(url)).toBe(true);

      const first = await source.fetch(url, AbortSignal.timeout(2000));
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const posting = first.value;

      expect(posting.title.trim()).not.toBe('');
      expect(posting.title.length).toBeLessThanOrEqual(200);
      if (posting.applyUrl !== null) expect(posting.applyUrl.startsWith('https://')).toBe(true);
      expect(posting.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
      expect(posting.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(posting.source).toBe(source.kind);

      const second = await source.fetch(url, AbortSignal.timeout(2000));
      expect(second.ok && second.value.sourceKey).toBe(posting.sourceKey);
    });
  });
}
