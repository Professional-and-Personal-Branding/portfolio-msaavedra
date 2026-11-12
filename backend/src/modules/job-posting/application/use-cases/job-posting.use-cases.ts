import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { fail, ok, Ok, Result } from '../../../../shared/domain/result';
import { slugifyDraft } from '../../../../shared/domain/slugify-draft';
import { JobPostingNotFoundError } from '../../domain/errors/job-posting-not-found.error';
import {
  JOB_POSTING_REPOSITORY,
  JobPostingRepository,
} from '../../domain/repositories/job-posting.repository';
import {
  TAG_VOCABULARY_READER,
  TagVocabularyReader,
} from '../../domain/repositories/tag-vocabulary.reader';
import { computeTagCoverage } from '../../domain/services/compute-tag-coverage';
import { JobPostingOutput, JobPostingSuggestionOutput } from '../dto/job-posting.output';
import { toJobPostingOutput } from '../mappers/job-posting.mapper';

const MAX_SUGGESTED_TITLE = 120;

/** Lista por `importedAt` descendente; borra primero el texto vencido (D13). */
@Injectable()
export class ListJobPostingsUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY) private readonly repo: JobPostingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<Ok<JobPostingOutput[]>> {
    await this.repo.purgeExpiredText(this.clock.now());
    return ok((await this.repo.list()).map(toJobPostingOutput));
  }
}

@Injectable()
export class GetJobPostingUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY) private readonly repo: JobPostingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: { id: string }): Promise<Result<JobPostingOutput, JobPostingNotFoundError>> {
    await this.repo.purgeExpiredText(this.clock.now());
    const found = await this.repo.findById(input.id);
    if (!found) return fail(new JobPostingNotFoundError(input.id));
    return ok(toJobPostingOutput(found));
  }
}

/** Borra solo la vacante: ningún perfil curado depende de ella (D21). */
@Injectable()
export class DeleteJobPostingUseCase {
  constructor(@Inject(JOB_POSTING_REPOSITORY) private readonly repo: JobPostingRepository) {}

  async execute(input: { id: string }): Promise<Result<void, JobPostingNotFoundError>> {
    const deleted = await this.repo.delete(input.id);
    if (!deleted) return fail(new JobPostingNotFoundError(input.id));
    return ok(undefined);
  }
}

/**
 * Sugerencia de criterios (D12): cobertura de los términos guardados contra el vocabulario
 * **vigente** (no se guarda), hasta 8 tags, un título y una base de slug. Funciona aunque el
 * texto ya se haya purgado: usa `detectedTerms`.
 */
@Injectable()
export class SuggestProfileCriteriaFromPostingUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY) private readonly repo: JobPostingRepository,
    @Inject(TAG_VOCABULARY_READER) private readonly vocabulary: TagVocabularyReader,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<JobPostingSuggestionOutput, JobPostingNotFoundError>> {
    const posting = await this.repo.findById(input.id);
    if (!posting) return fail(new JobPostingNotFoundError(input.id));

    const coverage = computeTagCoverage(posting.detectedTerms, await this.vocabulary.read());
    return ok({
      coverage: {
        covered: coverage.covered.map((entry) => ({ tag: entry.tag, evidence: entry.evidence })),
        uncovered: coverage.uncovered,
        detectedCount: coverage.detectedCount,
        coveredCount: coverage.coveredCount,
        ratio: coverage.ratio,
      },
      suggestedFilterTags: coverage.suggestedFilterTags,
      suggestedTitle: posting.title.slice(0, MAX_SUGGESTED_TITLE),
      suggestedSlugBase: slugifyDraft(posting.company, posting.title),
    });
  }
}
