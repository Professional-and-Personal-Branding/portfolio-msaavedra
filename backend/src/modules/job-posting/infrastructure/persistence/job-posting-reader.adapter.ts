import { Inject, Injectable } from '@nestjs/common';
import {
  JOB_POSTING_REPOSITORY,
  JobPostingRepository,
} from '../../domain/repositories/job-posting.repository';
import {
  JobPostingDraftSource,
  JobPostingReader,
} from '../../application/ports/job-posting.reader';

/** Adaptador del puerto de lectura sobre el repositorio del propio módulo. */
@Injectable()
export class RepositoryJobPostingReader implements JobPostingReader {
  constructor(@Inject(JOB_POSTING_REPOSITORY) private readonly repo: JobPostingRepository) {}

  async findDraftSource(id: string): Promise<JobPostingDraftSource | null> {
    const posting = await this.repo.findById(id);
    if (!posting) return null;
    return {
      id: posting.id,
      title: posting.title,
      company: posting.company,
      language: posting.language,
    };
  }
}
