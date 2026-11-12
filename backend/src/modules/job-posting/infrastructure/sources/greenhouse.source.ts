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
import {
  detectLanguage,
  detectWorkplaceType,
} from '../../domain/services/extract-from-pasted-text';
import { htmlToText } from '../../domain/services/html-to-text';
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
} from './source-helpers';

/** Host fijo de la API: no sale de la entrada (D3). */
const API_HOST = 'https://boards-api.greenhouse.io';

/**
 * Greenhouse por su API pública de job board (D3). La variante EU de las páginas
 * (`boards.eu.greenhouse.io`) no figura en la documentación oficial consultada el 2026-11-12:
 * esa URL no se atiende acá y cae al respaldo JSON-LD (ver `verification/4.6-ats-docs.md`).
 */
@Injectable()
export class GreenhouseSource implements JobPostingSource {
  readonly kind = 'GREENHOUSE' as const;

  constructor(@Inject(SAFE_HTTP_CLIENT) private readonly client: SafeHttpClient) {}

  canHandle(url: URL): boolean {
    const match = matchAtsUrl(url);
    return match.ok && match.value?.kind === 'GREENHOUSE' && !match.value.eu;
  }

  async fetch(url: URL, signal: AbortSignal): Promise<Result<NormalizedPosting, ImportFailure>> {
    const match = matchAtsUrl(url);
    if (!match.ok) return match;
    if (match.value?.kind !== 'GREENHOUSE') return fail(unparseable());
    const { board, id } = match.value;

    const api = new URL(`${API_HOST}/v1/boards/${board}/jobs/${id}`);
    const response = await this.client.get(api, {
      accept: 'json',
      maxBytes: MAX_JSON_BYTES,
      signal,
    });
    if (!response.ok) return response;

    const parsed = parseJson(response.value.body);
    if (!parsed.ok) return parsed;
    const job = asRecord(parsed.value);
    const title = asText(job?.title);
    if (!job || title === null) return fail(unparseable());

    const description = htmlToText(asText(job.content) ?? '');
    const location = clip(asText(asRecord(job.location)?.name), 200);
    return ok({
      source: 'GREENHOUSE',
      sourceKey: `greenhouse:${board}:${id}`.toLowerCase(),
      sourceUrl: canonicalizeUrl(url),
      applyUrl: httpsUrlOrNull(job.absolute_url),
      title: title.slice(0, 200),
      company: clip(asText(job.company_name) ?? humanizeSlug(board), 160),
      location,
      workplaceType: detectWorkplaceType(`${location ?? ''}\n${description}`),
      employmentType: null,
      compensation: null,
      language: detectLanguage(description),
      postedAt: dateOrNull(job.updated_at),
      description,
    });
  }
}
