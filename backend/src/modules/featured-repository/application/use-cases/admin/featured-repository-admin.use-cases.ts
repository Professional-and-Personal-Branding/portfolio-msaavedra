import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import { NewFeaturedRepositoryProps } from '../../../domain/entities/featured-repository.entity';
import { FeaturedRepositoryNotFoundError } from '../../../domain/errors/featured-repository-not-found.error';
import {
  FEATURED_REPOSITORY_REPOSITORY,
  FeaturedRepositoryRepository,
} from '../../../domain/repositories/featured-repository.repository';
import { githubRepositoryKeyOf } from '../../../domain/services/parse-github-repository-url';
import { validateFeaturedRepository } from '../../../domain/services/validate-featured-repository';
import { AdminFeaturedRepositoryOutput } from '../../dto/featured-repository.admin-output';
import { toAdminFeaturedRepositoryOutput } from '../../mappers/featured-repository.admin-mapper';

/**
 * Unicidad de `owner/repo` sin distinguir mayúsculas (D2). Se resuelve acá, con `findAll()`,
 * porque no hay índice único en la base; `exceptId` deja a un registro conservar su propia URL.
 */
async function findUrlConflict(
  repository: FeaturedRepositoryRepository,
  url: string,
  exceptId?: string,
): Promise<ConflictError | null> {
  const key = githubRepositoryKeyOf(url);
  if (key === null) return null;
  const all = await repository.findAll();
  const taken = all.some((r) => r.id !== exceptId && githubRepositoryKeyOf(r.url) === key);
  return taken
    ? new ConflictError('Repositorio destacado', 'Ese repositorio ya está cargado')
    : null;
}

/** Listado del backoffice: todos (incluidos ocultos), por `order`, datos crudos. */
@Injectable()
export class ListAllFeaturedRepositoriesUseCase {
  constructor(
    @Inject(FEATURED_REPOSITORY_REPOSITORY) private readonly repos: FeaturedRepositoryRepository,
  ) {}

  async execute(): Promise<Ok<AdminFeaturedRepositoryOutput[]>> {
    return ok((await this.repos.findAll()).map(toAdminFeaturedRepositoryOutput));
  }
}

@Injectable()
export class GetFeaturedRepositoryAdminUseCase {
  constructor(
    @Inject(FEATURED_REPOSITORY_REPOSITORY) private readonly repos: FeaturedRepositoryRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminFeaturedRepositoryOutput, FeaturedRepositoryNotFoundError>> {
    const found = await this.repos.findById(input.id);
    if (!found) return fail(new FeaturedRepositoryNotFoundError(input.id));
    return ok(toAdminFeaturedRepositoryOutput(found));
  }
}

@Injectable()
export class CreateFeaturedRepositoryUseCase {
  constructor(
    @Inject(FEATURED_REPOSITORY_REPOSITORY) private readonly repos: FeaturedRepositoryRepository,
  ) {}

  async execute(
    props: NewFeaturedRepositoryProps,
  ): Promise<Result<AdminFeaturedRepositoryOutput, ValidationError | ConflictError>> {
    const valid = validateFeaturedRepository(props);
    if (!valid.ok) return valid;
    const conflict = await findUrlConflict(this.repos, props.url);
    if (conflict) return fail(conflict);
    return ok(toAdminFeaturedRepositoryOutput(await this.repos.create(props)));
  }
}

export interface UpdateFeaturedRepositoryInput {
  id: string;
  changes: Partial<NewFeaturedRepositoryProps>;
}

@Injectable()
export class UpdateFeaturedRepositoryUseCase {
  constructor(
    @Inject(FEATURED_REPOSITORY_REPOSITORY) private readonly repos: FeaturedRepositoryRepository,
  ) {}

  async execute(
    input: UpdateFeaturedRepositoryInput,
  ): Promise<
    Result<
      AdminFeaturedRepositoryOutput,
      FeaturedRepositoryNotFoundError | ValidationError | ConflictError
    >
  > {
    const existing = await this.repos.findById(input.id);
    if (!existing) return fail(new FeaturedRepositoryNotFoundError(input.id));

    const updated = existing.with(input.changes);
    const valid = validateFeaturedRepository(updated.toProps());
    if (!valid.ok) return valid;

    // La unicidad solo se consulta si cambia la clave `owner/repo`: conservar la propia URL
    // (o cambiarle solo las mayúsculas) no choca.
    if (githubRepositoryKeyOf(updated.url) !== githubRepositoryKeyOf(existing.url)) {
      const conflict = await findUrlConflict(this.repos, updated.url, existing.id);
      if (conflict) return fail(conflict);
    }

    const saved = await this.repos.update(updated);
    if (!saved) return fail(new FeaturedRepositoryNotFoundError(input.id));
    return ok(toAdminFeaturedRepositoryOutput(saved));
  }
}

@Injectable()
export class DeleteFeaturedRepositoryUseCase {
  constructor(
    @Inject(FEATURED_REPOSITORY_REPOSITORY) private readonly repos: FeaturedRepositoryRepository,
  ) {}

  async execute(input: { id: string }): Promise<Result<void, FeaturedRepositoryNotFoundError>> {
    const deleted = await this.repos.delete(input.id);
    if (!deleted) return fail(new FeaturedRepositoryNotFoundError(input.id));
    return ok(undefined);
  }
}
