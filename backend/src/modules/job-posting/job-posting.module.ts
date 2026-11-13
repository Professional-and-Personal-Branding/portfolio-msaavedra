import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../shared/domain/clock';
import { JOB_POSTING_READER } from './application/ports/job-posting.reader';
import { JOB_POSTING_SOURCE_LIST, SAFE_HTTP_CLIENT } from './application/ports/job-posting-source';
import { ImportJobPostingUseCase } from './application/use-cases/import-job-posting.use-case';
import {
  DeleteJobPostingUseCase,
  GetJobPostingUseCase,
  ListJobPostingsUseCase,
  SuggestProfileCriteriaFromPostingUseCase,
} from './application/use-cases/job-posting.use-cases';
import { JOB_POSTING_REPOSITORY } from './domain/repositories/job-posting.repository';
import { TAG_VOCABULARY_READER } from './domain/repositories/tag-vocabulary.reader';
import { AdminJobPostingController } from './infrastructure/controllers/admin-job-posting.controller';
import { DefaultSafeHttpClient } from './infrastructure/http/default-safe-http-client';
import { DNS_RESOLVER, HTTP_TRANSPORT } from './infrastructure/http/http-transport';
import { NodeHttpTransport } from './infrastructure/http/node-http-transport';
import { SystemDnsResolver } from './infrastructure/http/system-dns-resolver';
import { RepositoryJobPostingReader } from './infrastructure/persistence/job-posting-reader.adapter';
import { PrismaJobPostingRepository } from './infrastructure/persistence/prisma-job-posting.repository';
import { PrismaTagVocabularyReader } from './infrastructure/persistence/prisma-tag-vocabulary.reader';
import { AshbySource } from './infrastructure/sources/ashby.source';
import { GreenhouseSource } from './infrastructure/sources/greenhouse.source';
import { JsonLdJobPostingSource } from './infrastructure/sources/json-ld-job-posting.source';
import { LeverSource } from './infrastructure/sources/lever.source';

/**
 * Vacantes importadas (change `add-job-posting-intake`): solo panel, sin rutas públicas.
 * **Sugiere**, no escribe perfiles: no importa nada de `curated-profile` (D1, D19). Exporta
 * únicamente el puerto de lectura `JOB_POSTING_READER`, que `curated-profile` usa para el borrador.
 *
 * La importación es síncrona (D2): no pasa por ninguna cola. El transporte HTTP y el resolvedor
 * DNS se inyectan por token para que los e2e los sustituyan; la política de direcciones es fija.
 */
@Module({
  controllers: [AdminJobPostingController],
  providers: [
    { provide: JOB_POSTING_REPOSITORY, useClass: PrismaJobPostingRepository },
    { provide: TAG_VOCABULARY_READER, useClass: PrismaTagVocabularyReader },
    { provide: JOB_POSTING_READER, useClass: RepositoryJobPostingReader },
    { provide: CLOCK, useValue: systemClock },
    { provide: HTTP_TRANSPORT, useFactory: () => new NodeHttpTransport() },
    { provide: DNS_RESOLVER, useClass: SystemDnsResolver },
    { provide: SAFE_HTTP_CLIENT, useClass: DefaultSafeHttpClient },
    GreenhouseSource,
    LeverSource,
    AshbySource,
    JsonLdJobPostingSource,
    {
      // El orden importa: los ATS primero y el respaldo JSON-LD, que acepta cualquier URL, al final.
      provide: JOB_POSTING_SOURCE_LIST,
      useFactory: (
        greenhouse: GreenhouseSource,
        lever: LeverSource,
        ashby: AshbySource,
        jsonLd: JsonLdJobPostingSource,
      ) => [greenhouse, lever, ashby, jsonLd],
      inject: [GreenhouseSource, LeverSource, AshbySource, JsonLdJobPostingSource],
    },
    ImportJobPostingUseCase,
    ListJobPostingsUseCase,
    GetJobPostingUseCase,
    DeleteJobPostingUseCase,
    SuggestProfileCriteriaFromPostingUseCase,
  ],
  exports: [JOB_POSTING_READER],
})
export class JobPostingModule {}
