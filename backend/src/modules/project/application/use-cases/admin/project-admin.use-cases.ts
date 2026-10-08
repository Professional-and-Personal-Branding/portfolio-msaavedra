import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import { NewProjectProps } from '../../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import {
  PROJECT_REPOSITORY,
  ProjectRepository,
} from '../../../domain/repositories/project.repository';
import { validateProject } from '../../../domain/services/validate-project';
import { AdminProjectOutput } from '../../dto/project.admin-output';
import { toAdminProjectOutput } from '../../mappers/project.admin-mapper';

/** Listado del backoffice: todos (incluidos ocultos), por `order`, datos crudos. */
@Injectable()
export class ListAllProjectsUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async execute(): Promise<Ok<AdminProjectOutput[]>> {
    return ok((await this.projects.findAll()).map(toAdminProjectOutput));
  }
}

@Injectable()
export class GetProjectAdminUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async execute(input: { id: string }): Promise<Result<AdminProjectOutput, ProjectNotFoundError>> {
    const found = await this.projects.findById(input.id);
    if (!found) return fail(new ProjectNotFoundError(input.id));
    return ok(toAdminProjectOutput(found));
  }
}

@Injectable()
export class CreateProjectUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async execute(props: NewProjectProps): Promise<Result<AdminProjectOutput, ValidationError>> {
    const valid = validateProject(props);
    if (!valid.ok) return valid;
    return ok(toAdminProjectOutput(await this.projects.create(props)));
  }
}

export interface UpdateProjectInput {
  id: string;
  changes: Partial<NewProjectProps>;
}

@Injectable()
export class UpdateProjectUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async execute(
    input: UpdateProjectInput,
  ): Promise<Result<AdminProjectOutput, ProjectNotFoundError | ValidationError>> {
    const existing = await this.projects.findById(input.id);
    if (!existing) return fail(new ProjectNotFoundError(input.id));

    const updated = existing.with(input.changes);
    const valid = validateProject(updated.toProps());
    if (!valid.ok) return valid;

    const saved = await this.projects.update(updated);
    if (!saved) return fail(new ProjectNotFoundError(input.id));
    return ok(toAdminProjectOutput(saved));
  }
}

@Injectable()
export class DeleteProjectUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async execute(input: { id: string }): Promise<Result<void, ProjectNotFoundError>> {
    const deleted = await this.projects.delete(input.id);
    if (!deleted) return fail(new ProjectNotFoundError(input.id));
    return ok(undefined);
  }
}
