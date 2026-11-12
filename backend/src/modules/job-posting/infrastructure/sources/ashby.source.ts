import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  JobPostingSource,
  MAX_JSON_BYTES,
  SAFE_HTTP_CLIENT,
  SafeHttpClient,
} from '../../application/ports/job-posting-source';
import { NormalizedPosting } from '../../domain/entities/job-posting.entity';
import { ImportFailure } from '../../domain/errors/import-failure';
import { canonicalizeUrl } from '../../domain/services/canonicalize-url';
import { detectLanguage } from '../../domain/services/extract-from-pasted-text';
import { matchAtsUrl } from '../../domain/services/match-ats-url';
import {
  asRecord,
  asText,
  clip,
  dateOrNull,
  httpsUrlOrNull,
  humanizeSlug,
  parseJson,
  unparseable,
  workplaceFromWord,
} from './source-helpers';

/** Host fijo de la API (D3). */
const API_HOST = 'https://api.ashbyhq.com';

/**
 * Ashby por su API pública del board (D3). No hay endpoint de una sola vacante: se baja el board
 * (tope 5 MiB) con `includeCompensation=true` y se elige la del `id` pedido. El campo `id` no
 * figura en la documentación consultada: forma supuesta, ver `verification/4.6-ats-docs.md`.
 */
@Injectable()
export class AshbySource implements JobPostingSource {
  readonly kind = 'ASHBY' as const;

  constructor(@Inject(SAFE_HTTP_CLIENT) private readonly client: SafeHttpClient) {}

  canHandle(url: URL): boolean {
    const match = matchAtsUrl(url);
    return match.ok && match.value?.kind === 'ASHBY';
  }

  async fetch(url: URL, signal: AbortSignal): Promise<Result<NormalizedPosting, ImportFailure>> {
    const match = matchAtsUrl(url);
    if (!match.ok) return match;
    if (match.value?.kind !== 'ASHBY') return fail(unparseable());
    const { org, id } = match.value;

    const api = new URL(`${API_HOST}/posting-api/job-board/${org}?includeCompensation=true`);
    const response = await this.client.get(api, {
      accept: 'json',
      maxBytes: MAX_JSON_BYTES,
      signal,
    });
    if (!response.ok) return response;

    const parsed = parseJson(response.value.body);
    if (!parsed.ok) return parsed;
    const jobs = asRecord(parsed.value)?.jobs;
    if (!Array.isArray(jobs)) return fail(unparseable());

    const wanted = id.toLowerCase();
    const job = jobs
      .map((entry) => asRecord(entry))
      .find((entry) => (asText(entry?.id) ?? '').toLowerCase() === wanted);
    if (!job) {
      return fail(
        ImportFailure.withHint('not-found', 'No encontramos esa vacante (puede estar cerrada)'),
      );
    }
    const title = asText(job.title);
    if (title === null) return fail(unparseable());

    const description = asText(job.descriptionPlain) ?? '';
    const compensation = asText(asRecord(job.compensation)?.compensationTierSummary);
    const workplace =
      workplaceFromWord(job.workplaceType) ?? (job.isRemote === true ? 'REMOTE' : null);
    return ok({
      source: 'ASHBY',
      sourceKey: `ashby:${org}:${id}`.toLowerCase(),
      sourceUrl: canonicalizeUrl(url),
      applyUrl: httpsUrlOrNull(job.applyUrl),
      title: title.slice(0, 200),
      company: clip(humanizeSlug(org), 160),
      location: clip(asText(job.location), 200),
      workplaceType: workplace,
      employmentType: clip(asText(job.employmentType), 60),
      compensation: clip(compensation, 200),
      language: detectLanguage(description),
      postedAt: dateOrNull(job.publishedAt),
      description,
    });
  }
}
