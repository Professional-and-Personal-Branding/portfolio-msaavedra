import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  CERTIFICATION_REPOSITORY,
  CertificationRepository,
  EDUCATION_REPOSITORY,
  EducationRepository,
} from '../../domain/repositories/education.repository';
import { CertificationOutput, EducationOutput } from '../dto/education.output';
import { toCertificationOutput, toEducationOutput } from '../mappers/education.mapper';

@Injectable()
export class ListEducationUseCase {
  constructor(@Inject(EDUCATION_REPOSITORY) private readonly repo: EducationRepository) {}

  async execute(input: { locale: Locale }): Promise<Ok<EducationOutput[]>> {
    const items = await this.repo.findAllVisible();
    return ok(items.filter((e) => e.visible).map((e) => toEducationOutput(e, input.locale)));
  }
}

@Injectable()
export class ListCertificationsUseCase {
  constructor(@Inject(CERTIFICATION_REPOSITORY) private readonly repo: CertificationRepository) {}

  async execute(input: { locale: Locale }): Promise<Ok<CertificationOutput[]>> {
    const items = await this.repo.findAllVisible();
    return ok(items.filter((c) => c.visible).map((c) => toCertificationOutput(c, input.locale)));
  }
}
