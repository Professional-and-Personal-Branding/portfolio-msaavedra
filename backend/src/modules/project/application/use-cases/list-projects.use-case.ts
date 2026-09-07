import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  PROJECT_REPOSITORY,
  ProjectRepository,
} from '../../domain/repositories/project.repository';
import { ProjectOutput } from '../dto/project.output';
import { toProjectOutput } from '../mappers/project.mapper';

@Injectable()
export class ListProjectsUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepository) {}

  async execute(input: { locale: Locale }): Promise<Ok<ProjectOutput[]>> {
    const items = await this.repo.findAllVisible();
    return ok(items.filter((p) => p.visible).map((p) => toProjectOutput(p, input.locale)));
  }
}
