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
  workplaceFromWord,
} from './source-helpers';

/** Hosts fijos de la API (D3); `jobs.eu.lever.co` usa `api.eu.lever.co`. */
const API_HOSTS = { global: 'https://api.lever.co', eu: 'https://api.eu.lever.co' } as const;

/** Lever por su API pública de postings (D3). */
@Injectable()
export class LeverSource implements JobPostingSource {
  readonly kind = 'LEVER' as const;

  constructor(@Inject(SAFE_HTTP_CLIENT) private readonly client: SafeHttpClient) {}

  canHandle(url: URL): boolean {
    const match = matchAtsUrl(url);
    return match.ok && match.value?.kind === 'LEVER';
  }

  async fetch(url: URL, signal: AbortSignal): Promise<Result<NormalizedPosting, ImportFailure>> {
    const match = matchAtsUrl(url);
    if (!match.ok) return match;
    if (match.value?.kind !== 'LEVER') return fail(unparseable());
    const { site, id, eu } = match.value;

    const api = new URL(`${API_HOSTS[eu ? 'eu' : 'global']}/v0/postings/${site}/${id}`);
    const response = await this.client.get(api, {
      accept: 'json',
      maxBytes: MAX_JSON_BYTES,
      signal,
    });
    if (!response.ok) return response;

    const parsed = parseJson(response.value.body);
    if (!parsed.ok) return parsed;
    const posting = asRecord(parsed.value);
    const title = asText(posting?.text);
    if (!posting || title === null) return fail(unparseable());

    // descripción = descriptionPlain + listas (HTML) + additionalPlain
    const lists = Array.isArray(posting.lists) ? posting.lists : [];
    const listText = lists
      .map((entry) => {
        const list = asRecord(entry);
        const heading = asText(list?.text);
        const items = htmlToText(`<ul>${asText(list?.content) ?? ''}</ul>`);
        return [heading, items].filter((part) => part).join('\n');
      })
      .filter((part) => part !== '');
    const description = [
      asText(posting.descriptionPlain),
      ...listText,
      asText(posting.additionalPlain),
    ]
      .filter((part): part is string => part !== null)
      .join('\n\n');

    const categories = asRecord(posting.categories);
    return ok({
      source: 'LEVER',
      sourceKey: `lever:${site}:${id}`.toLowerCase(),
      sourceUrl: canonicalizeUrl(url),
      applyUrl: httpsUrlOrNull(posting.applyUrl),
      title: title.slice(0, 200),
      company: clip(humanizeSlug(site), 160),
      location: clip(asText(categories?.location), 200),
      workplaceType: workplaceFromWord(posting.workplaceType),
      employmentType: clip(asText(categories?.commitment), 60),
      compensation: null,
      language: detectLanguage(description),
      postedAt: dateOrNull(posting.createdAt),
      description,
    });
  }
}
