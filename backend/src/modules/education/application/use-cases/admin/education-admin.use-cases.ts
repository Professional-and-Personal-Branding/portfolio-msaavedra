import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../../shared/domain/errors';
import { fail, ok, Ok, Result } from '../../../../../shared/domain/result';
import { NewCertificationProps } from '../../../domain/entities/certification.entity';
import { NewEducationProps } from '../../../domain/entities/education.entity';
import { CertificationNotFoundError } from '../../../domain/errors/certification-not-found.error';
import { EducationNotFoundError } from '../../../domain/errors/education-not-found.error';
import {
  CERTIFICATION_REPOSITORY,
  CertificationRepository,
  EDUCATION_REPOSITORY,
  EducationRepository,
} from '../../../domain/repositories/education.repository';
import { validateCertification } from '../../../domain/services/validate-certification';
import { validateEducation } from '../../../domain/services/validate-education';
import { AdminCertificationOutput, AdminEducationOutput } from '../../dto/education.admin-output';
import {
  toAdminCertificationOutput,
  toAdminEducationOutput,
} from '../../mappers/education.admin-mapper';

/* Formación */

/** Listado del backoffice: todas (incluidas ocultas), por `order`, datos crudos. */
@Injectable()
export class ListAllEducationUseCase {
  constructor(@Inject(EDUCATION_REPOSITORY) private readonly education: EducationRepository) {}

  async execute(): Promise<Ok<AdminEducationOutput[]>> {
    return ok((await this.education.findAll()).map(toAdminEducationOutput));
  }
}

@Injectable()
export class GetEducationAdminUseCase {
  constructor(@Inject(EDUCATION_REPOSITORY) private readonly education: EducationRepository) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminEducationOutput, EducationNotFoundError>> {
    const found = await this.education.findById(input.id);
    if (!found) return fail(new EducationNotFoundError(input.id));
    return ok(toAdminEducationOutput(found));
  }
}

@Injectable()
export class CreateEducationUseCase {
  constructor(@Inject(EDUCATION_REPOSITORY) private readonly education: EducationRepository) {}

  async execute(props: NewEducationProps): Promise<Result<AdminEducationOutput, ValidationError>> {
    const valid = validateEducation(props);
    if (!valid.ok) return valid;
    return ok(toAdminEducationOutput(await this.education.create(props)));
  }
}

export interface UpdateEducationInput {
  id: string;
  changes: Partial<NewEducationProps>;
}

@Injectable()
export class UpdateEducationUseCase {
  constructor(@Inject(EDUCATION_REPOSITORY) private readonly education: EducationRepository) {}

  async execute(
    input: UpdateEducationInput,
  ): Promise<Result<AdminEducationOutput, EducationNotFoundError | ValidationError>> {
    const existing = await this.education.findById(input.id);
    if (!existing) return fail(new EducationNotFoundError(input.id));

    const updated = existing.with(input.changes);
    const valid = validateEducation(updated.toProps());
    if (!valid.ok) return valid;

    const saved = await this.education.update(updated);
    if (!saved) return fail(new EducationNotFoundError(input.id));
    return ok(toAdminEducationOutput(saved));
  }
}

@Injectable()
export class DeleteEducationUseCase {
  constructor(@Inject(EDUCATION_REPOSITORY) private readonly education: EducationRepository) {}

  async execute(input: { id: string }): Promise<Result<void, EducationNotFoundError>> {
    const deleted = await this.education.delete(input.id);
    if (!deleted) return fail(new EducationNotFoundError(input.id));
    return ok(undefined);
  }
}

/* Certificaciones */

/** Listado del backoffice: todas (incluidas ocultas), por `order`, datos crudos. */
@Injectable()
export class ListAllCertificationsUseCase {
  constructor(
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
  ) {}

  async execute(): Promise<Ok<AdminCertificationOutput[]>> {
    return ok((await this.certifications.findAll()).map(toAdminCertificationOutput));
  }
}

@Injectable()
export class GetCertificationAdminUseCase {
  constructor(
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
  ) {}

  async execute(input: {
    id: string;
  }): Promise<Result<AdminCertificationOutput, CertificationNotFoundError>> {
    const found = await this.certifications.findById(input.id);
    if (!found) return fail(new CertificationNotFoundError(input.id));
    return ok(toAdminCertificationOutput(found));
  }
}

@Injectable()
export class CreateCertificationUseCase {
  constructor(
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
  ) {}

  async execute(
    props: NewCertificationProps,
  ): Promise<Result<AdminCertificationOutput, ValidationError>> {
    const valid = validateCertification(props);
    if (!valid.ok) return valid;
    return ok(toAdminCertificationOutput(await this.certifications.create(props)));
  }
}

export interface UpdateCertificationInput {
  id: string;
  changes: Partial<NewCertificationProps>;
}

@Injectable()
export class UpdateCertificationUseCase {
  constructor(
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
  ) {}

  async execute(
    input: UpdateCertificationInput,
  ): Promise<Result<AdminCertificationOutput, CertificationNotFoundError | ValidationError>> {
    const existing = await this.certifications.findById(input.id);
    if (!existing) return fail(new CertificationNotFoundError(input.id));

    const updated = existing.with(input.changes);
    const valid = validateCertification(updated.toProps());
    if (!valid.ok) return valid;

    const saved = await this.certifications.update(updated);
    if (!saved) return fail(new CertificationNotFoundError(input.id));
    return ok(toAdminCertificationOutput(saved));
  }
}

@Injectable()
export class DeleteCertificationUseCase {
  constructor(
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
  ) {}

  async execute(input: { id: string }): Promise<Result<void, CertificationNotFoundError>> {
    const deleted = await this.certifications.delete(input.id);
    if (!deleted) return fail(new CertificationNotFoundError(input.id));
    return ok(undefined);
  }
}
