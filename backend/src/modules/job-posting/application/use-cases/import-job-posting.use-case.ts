import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { classifyClosedPortal, closedPortalMessage } from '../../domain/closed-portals';
import {
  MAX_DESCRIPTION_LENGTH,
  NormalizedPosting,
  TEXT_RETENTION_DAYS,
} from '../../domain/entities/job-posting.entity';
import { ImportFailure } from '../../domain/errors/import-failure';
import {
  JOB_POSTING_REPOSITORY,
  JobPostingRepository,
} from '../../domain/repositories/job-posting.repository';
import {
  TAG_VOCABULARY_READER,
  TagVocabularyReader,
} from '../../domain/repositories/tag-vocabulary.reader';
import { canonicalizeUrl } from '../../domain/services/canonicalize-url';
import { checkUrlPolicy, MAX_URL_LENGTH } from '../../domain/services/check-url-policy';
import { detectTerms } from '../../domain/services/detect-terms';
import {
  extractFromPastedText,
  pastedSourceKey,
} from '../../domain/services/extract-from-pasted-text';
import { matchAtsUrl } from '../../domain/services/match-ats-url';
import { TERM_DICTIONARY } from '../../domain/term-dictionary';
import { ImportJobPostingOutput } from '../dto/job-posting.output';
import { toJobPostingOutput } from '../mappers/job-posting.mapper';
import { JOB_POSTING_SOURCE_LIST, JobPostingSource } from '../ports/job-posting-source';

/** Plazo de toda la importación: DNS, conexión, redirects y cuerpo (D9). */
export const IMPORT_TIMEOUT_MS = 10_000;

export const MIN_TEXT_LENGTH = 50;
export const MAX_TEXT_LENGTH = 50_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `url` XOR `text` (la forma la valida el DTO; acá se vuelve a exigir). */
export interface ImportJobPostingInput {
  url?: string;
  text?: string;
  /** Solo con `text`. */
  title?: string;
  company?: string;
  /** Solo con `text`: https, de referencia; se guarda y nunca se pide (D6). */
  referenceUrl?: string;
}

type ImportError = ImportFailure | ValidationError;

/**
 * Importa una vacante desde una URL o desde texto pegado (D2, D6): una acción síncrona del owner,
 * sin cola. Un portal cerrado, la política de URL y la guarda de red cortan antes de cualquier
 * petición; el texto pegado nunca sale a la red, ni siquiera con una URL de referencia.
 */
@Injectable()
export class ImportJobPostingUseCase {
  private readonly logger = new Logger(ImportJobPostingUseCase.name);

  constructor(
    @Inject(JOB_POSTING_REPOSITORY) private readonly repo: JobPostingRepository,
    @Inject(TAG_VOCABULARY_READER) private readonly vocabulary: TagVocabularyReader,
    @Inject(JOB_POSTING_SOURCE_LIST) private readonly sources: readonly JobPostingSource[],
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    input: ImportJobPostingInput,
  ): Promise<Result<ImportJobPostingOutput, ImportError>> {
    const started = Date.now();
    const now = this.clock.now();
    await this.repo.purgeExpiredText(now);

    const hasUrl = input.url !== undefined;
    const hasText = input.text !== undefined;
    if (hasUrl === hasText) {
      return fail(
        new ValidationError('Indicá la URL o el texto de la vacante, no ambos', ['url', 'text']),
      );
    }

    if (hasUrl && (input.title || input.company || input.referenceUrl)) {
      return fail(
        new ValidationError(
          'El título, la empresa y la URL de referencia son solo para el texto pegado',
          ['title', 'company', 'referenceUrl'],
        ),
      );
    }

    const normalized = hasUrl ? await this.fromUrl(input.url ?? '') : this.fromText(input);
    if (!normalized.ok) {
      this.log(input.url, undefined, 'failed', started, normalized.error);
      return normalized;
    }

    const posting = normalized.value;
    const truncated = posting.description.length > MAX_DESCRIPTION_LENGTH;
    const description = truncated
      ? posting.description.slice(0, MAX_DESCRIPTION_LENGTH)
      : posting.description;
    const { tags } = await this.vocabulary.read();
    const detectedTerms = detectTerms(`${posting.title}\n${description}`, TERM_DICTIONARY, tags);

    const saved = await this.repo.upsertBySourceKey({
      ...posting,
      description,
      descriptionTruncated: truncated,
      detectedTerms,
      importedAt: now,
      textPurgeAt: new Date(now.getTime() + TEXT_RETENTION_DAYS * DAY_MS),
    });
    this.log(input.url, posting.source, saved.created ? 'created' : 'updated', started);
    return ok({ posting: toJobPostingOutput(saved.posting), created: saved.created });
  }

  private async fromUrl(raw: string): Promise<Result<NormalizedPosting, ImportError>> {
    const policy = checkUrlPolicy(raw);
    if (!policy.ok) return policy;
    const url = policy.value;

    const portal = classifyClosedPortal(url.hostname);
    if (portal) return fail(new ImportFailure('closed-portal', closedPortalMessage(portal)));

    const ats = matchAtsUrl(url);
    if (!ats.ok) return ats;

    const source = this.sources.find((candidate) => candidate.canHandle(url));
    if (!source) return fail(ImportFailure.withHint('unparseable', 'No pudimos leer esa vacante'));
    return source.fetch(url, AbortSignal.timeout(IMPORT_TIMEOUT_MS));
  }

  private fromText(input: ImportJobPostingInput): Result<NormalizedPosting, ValidationError> {
    const text = (input.text ?? '').trim();
    if (text.length < MIN_TEXT_LENGTH) {
      return fail(
        new ValidationError(`El texto debe tener al menos ${MIN_TEXT_LENGTH} caracteres`, ['text']),
      );
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return fail(
        new ValidationError(`El texto admite como máximo ${MAX_TEXT_LENGTH} caracteres`, ['text']),
      );
    }

    let sourceUrl: string | null = null;
    const reference = input.referenceUrl?.trim();
    if (reference) {
      // Solo se guarda: nunca se pide. Por eso alcanza con que sea una URL https razonable.
      let parsed: URL | null = null;
      try {
        parsed = new URL(reference);
      } catch {
        parsed = null;
      }
      if (!parsed || parsed.protocol !== 'https:' || reference.length > MAX_URL_LENGTH) {
        return fail(
          new ValidationError('La URL de referencia debe empezar con https://', ['referenceUrl']),
        );
      }
      sourceUrl = canonicalizeUrl(parsed);
    }

    const extracted = extractFromPastedText({ text, title: input.title, company: input.company });
    return ok({
      source: 'PASTED',
      sourceKey: pastedSourceKey(text),
      sourceUrl,
      applyUrl: null,
      title: extracted.title,
      company: input.company?.trim() ? input.company.trim().slice(0, 160) : null,
      location: null,
      workplaceType: extracted.workplaceType,
      employmentType: extracted.employmentType,
      compensation: null,
      language: extracted.language,
      postedAt: null,
      description: text,
    });
  }

  /** Solo host, fuente, resultado y duración: nunca la ruta, la query ni el cuerpo (D9). */
  private log(
    rawUrl: string | undefined,
    source: string | undefined,
    outcome: string,
    started: number,
    error?: ImportError,
  ): void {
    let host: string | null = null;
    if (rawUrl) {
      try {
        host = new URL(rawUrl).hostname;
      } catch {
        host = null;
      }
    }
    this.logger.log({
      event: 'job-posting.import',
      host,
      source: source ?? 'none',
      outcome,
      reason: error instanceof ImportFailure ? error.reason : undefined,
      durationMs: Date.now() - started,
    });
  }
}
