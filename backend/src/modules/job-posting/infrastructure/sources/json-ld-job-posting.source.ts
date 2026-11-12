import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  JobPostingSource,
  MAX_HTML_BYTES,
  SAFE_HTTP_CLIENT,
  SafeHttpClient,
} from '../../application/ports/job-posting-source';
import { NormalizedPosting, WorkplaceType } from '../../domain/entities/job-posting.entity';
import { ImportFailure } from '../../domain/errors/import-failure';
import { canonicalizeUrl } from '../../domain/services/canonicalize-url';
import {
  detectLanguage,
  detectWorkplaceType,
} from '../../domain/services/extract-from-pasted-text';
import { htmlToText } from '../../domain/services/html-to-text';
import {
  asRecord,
  asText,
  clip,
  dateOrNull,
  httpsUrlOrNull,
  JsonRecord,
  noPostingFound,
  unparseable,
} from './source-helpers';

const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const LD_JSON_TYPE = /\btype\s*=\s*["']?\s*application\/ld\+json\b/i;

/** Cuerpos de los `<script type="application/ld+json">`, atributos en cualquier orden y caso. */
export function extractLdJsonBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const match of html.matchAll(SCRIPT_BLOCK)) {
    if (LD_JSON_TYPE.test(match[1])) blocks.push(match[2]);
  }
  return blocks;
}

function typesOf(node: JsonRecord): string[] {
  const type = node['@type'];
  if (typeof type === 'string') return [type];
  return Array.isArray(type) ? type.filter((t): t is string => typeof t === 'string') : [];
}

/** Aplana un objeto, un arreglo o `@graph` en nodos candidatos. */
function nodesOf(value: unknown, depth = 0): JsonRecord[] {
  if (depth > 3) return [];
  if (Array.isArray(value)) return value.flatMap((item) => nodesOf(item, depth + 1));
  const record = asRecord(value);
  if (!record) return [];
  return [record, ...nodesOf(record['@graph'], depth + 1)];
}

/** El primer `JobPosting` de la página, o `null`. */
export function findJobPosting(html: string): JsonRecord | null {
  for (const block of extractLdJsonBlocks(html)) {
    let json: unknown;
    try {
      json = JSON.parse(block);
    } catch {
      continue;
    }
    const found = nodesOf(json).find((node) => typesOf(node).includes('JobPosting'));
    if (found) return found;
  }
  return null;
}

function organizationName(value: unknown): string | null {
  return asText(value) ?? asText(asRecord(value)?.name);
}

function locationText(value: unknown): string | null {
  const places = Array.isArray(value) ? value : [value];
  const first = asRecord(places[0]);
  const address = asRecord(first?.address);
  if (!address) return asText(first?.name) ?? asText(value);
  const country = asText(address.addressCountry) ?? asText(asRecord(address.addressCountry)?.name);
  const parts = [asText(address.addressLocality), asText(address.addressRegion), country].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? null : parts.join(', ');
}

function employmentText(value: unknown): string | null {
  const first: unknown = Array.isArray(value) ? (value as unknown[])[0] : value;
  const text = asText(first);
  return text === null ? null : text.toLowerCase().replace(/_/g, '-');
}

function salaryText(value: unknown): string | null {
  const salary = asRecord(value);
  if (!salary) return asText(value);
  const currency = asText(salary.currency);
  const amount = asRecord(salary.value);
  const min = asText(amount?.minValue);
  const max = asText(amount?.maxValue);
  const single = asText(amount?.value) ?? asText(salary.value);
  const unit = asText(amount?.unitText);
  const range = min !== null && max !== null ? `${min} - ${max}` : (single ?? min ?? max);
  if (range === null) return null;
  return [currency, range, unit ? `/ ${unit.toLowerCase()}` : null]
    .filter((part) => part)
    .join(' ');
}

/**
 * Respaldo para cualquier host https público que no sea de un ATS ni un portal cerrado (D4): lee
 * la página como HTML (tope 2 MiB) y toma el primer bloque JSON-LD `JobPosting`. Sin parser de
 * HTML: un escáner de `<script>` y `JSON.parse` por bloque.
 */
@Injectable()
export class JsonLdJobPostingSource implements JobPostingSource {
  readonly kind = 'JSON_LD' as const;

  constructor(@Inject(SAFE_HTTP_CLIENT) private readonly client: SafeHttpClient) {}

  /** Es el último recurso: el caso de uso lo prueba después de las fuentes de ATS. */
  canHandle(): boolean {
    return true;
  }

  async fetch(url: URL, signal: AbortSignal): Promise<Result<NormalizedPosting, ImportFailure>> {
    const response = await this.client.get(url, {
      accept: 'html',
      maxBytes: MAX_HTML_BYTES,
      signal,
    });
    if (!response.ok) return response;

    const job = findJobPosting(response.value.body);
    if (!job) return fail(noPostingFound());
    const title = asText(job.title) ?? asText(job.name);
    if (title === null) return fail(unparseable());

    const description = htmlToText(asText(job.description) ?? '');
    const workplace: WorkplaceType | null =
      asText(job.jobLocationType)?.toUpperCase() === 'TELECOMMUTE'
        ? 'REMOTE'
        : detectWorkplaceType(description);
    const canonical = canonicalizeUrl(url);
    return ok({
      source: 'JSON_LD',
      sourceKey: `jsonld:${canonical}`,
      sourceUrl: canonical,
      applyUrl:
        httpsUrlOrNull(job.url) ?? (job.url === undefined ? httpsUrlOrNull(canonical) : null),
      title: title.slice(0, 200),
      company: clip(organizationName(job.hiringOrganization), 160),
      location: clip(locationText(job.jobLocation), 200),
      workplaceType: workplace,
      employmentType: clip(employmentText(job.employmentType), 60),
      compensation: clip(salaryText(job.baseSalary), 200),
      language: detectLanguage(description),
      postedAt: dateOrNull(asText(job.datePosted)),
      description,
    });
  }
}
