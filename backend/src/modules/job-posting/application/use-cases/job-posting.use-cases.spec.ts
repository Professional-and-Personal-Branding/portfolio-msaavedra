import { Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { fail, ok } from '../../../../shared/domain/result';
import { collectTagVocabulary, TagVocabulary } from '../../../../shared/domain/tag-vocabulary';
import {
  JobPosting,
  NewJobPosting,
  NormalizedPosting,
} from '../../domain/entities/job-posting.entity';
import { ImportFailure } from '../../domain/errors/import-failure';
import {
  JobPostingRepository,
  UpsertJobPostingResult,
} from '../../domain/repositories/job-posting.repository';
import { JobPostingSource } from '../ports/job-posting-source';
import { toJobPostingOutput } from '../mappers/job-posting.mapper';
import { ImportJobPostingUseCase } from './import-job-posting.use-case';
import {
  DeleteJobPostingUseCase,
  GetJobPostingUseCase,
  ListJobPostingsUseCase,
  SuggestProfileCriteriaFromPostingUseCase,
} from './job-posting.use-cases';

const DAY = 24 * 60 * 60 * 1000;

beforeAll(() => {
  Logger.overrideLogger(false);
});

class FakeClock implements Clock {
  constructor(public current: Date) {}
  now(): Date {
    return this.current;
  }
}

/** Repositorio en memoria con la misma semántica que el de Prisma. */
class InMemoryRepo implements JobPostingRepository {
  readonly rows = new Map<string, JobPosting>();
  readonly purgeCalls: Date[] = [];
  private seq = 0;

  upsertBySourceKey(data: NewJobPosting): Promise<UpsertJobPostingResult> {
    const existing = [...this.rows.values()].find((row) => row.sourceKey === data.sourceKey);
    const now = data.importedAt;
    const posting: JobPosting = existing
      ? { ...data, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
      : { ...data, id: `jp${++this.seq}`, createdAt: now, updatedAt: now };
    this.rows.set(posting.id, posting);
    return Promise.resolve({ posting, created: !existing });
  }
  list(): Promise<JobPosting[]> {
    return Promise.resolve(
      [...this.rows.values()].sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime()),
    );
  }
  findById(id: string): Promise<JobPosting | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id));
  }
  purgeExpiredText(now: Date): Promise<number> {
    this.purgeCalls.push(now);
    let count = 0;
    for (const [id, row] of this.rows) {
      if (row.textPurgeAt <= now && row.description !== null) {
        this.rows.set(id, { ...row, description: null, descriptionTruncated: false });
        count += 1;
      }
    }
    return Promise.resolve(count);
  }
}

const vocabulary = (...tags: string[]): TagVocabulary =>
  collectTagVocabulary(tags.map((tag) => ({ tags: [tag], visible: true })));

function normalized(overrides: Partial<NormalizedPosting> = {}): NormalizedPosting {
  return {
    source: 'GREENHOUSE',
    sourceKey: 'greenhouse:acme:1',
    sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
    applyUrl: null,
    title: 'Tech Lead Backend',
    company: 'Acme Ejemplo',
    location: null,
    workplaceType: null,
    employmentType: null,
    compensation: null,
    language: 'es',
    postedAt: null,
    description: 'Java, Spring Boot y Kubernetes. Liderazgo de equipos.',
    ...overrides,
  };
}

function setup(options: { vocab?: TagVocabulary; source?: Partial<JobPostingSource> } = {}) {
  const repo = new InMemoryRepo();
  const clock = new FakeClock(new Date('2026-11-12T12:00:00.000Z'));
  let vocab = options.vocab ?? vocabulary('java', 'spring-boot');
  const fetchSpy = jest.fn(() => Promise.resolve(ok(normalized())));
  const source: JobPostingSource = {
    kind: 'GREENHOUSE',
    canHandle: () => true,
    fetch: fetchSpy,
    ...options.source,
  };
  const reader = { read: () => Promise.resolve(vocab) };
  const importer = new ImportJobPostingUseCase(repo, reader, [source], clock);
  return {
    repo,
    clock,
    source,
    fetchSpy,
    importer,
    setVocab: (next: TagVocabulary) => (vocab = next),
    list: new ListJobPostingsUseCase(repo, clock),
    get: new GetJobPostingUseCase(repo, clock),
    del: new DeleteJobPostingUseCase(repo),
    suggest: new SuggestProfileCriteriaFromPostingUseCase(repo, reader),
  };
}

const URL_OK = 'https://boards.greenhouse.io/acme/jobs/1';
const TEXT = 'Tech Lead\nBuscamos un líder con Java, Kubernetes y liderazgo para nuestro equipo.';

describe('ImportJobPostingUseCase', () => {
  it('(a) un portal cerrado no llama a ninguna fuente', async () => {
    const { importer, fetchSpy } = setup();
    const result = await importer.execute({ url: 'https://www.linkedin.com/jobs/view/123' });
    expect(!result.ok && result.error).toBeInstanceOf(ImportFailure);
    expect(!result.ok && (result.error as ImportFailure).reason).toBe('closed-portal');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('una URL que no cumple la política no llama a ninguna fuente', async () => {
    const { importer, fetchSpy } = setup();
    for (const url of ['http://x.acme-ejemplo.com/', 'https://127.0.0.1/', 'https://intranet/']) {
      expect((await importer.execute({ url })).ok).toBe(false);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('(b) el texto pegado con URL de referencia no llama a ninguna fuente', async () => {
    const { importer, fetchSpy } = setup();
    const result = await importer.execute({
      text: TEXT,
      referenceUrl: 'https://www.linkedin.com/jobs/view/123?trk=x#y',
    });
    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.value.posting.source).toBe('PASTED');
      expect(result.value.posting.sourceUrl).toBe('https://www.linkedin.com/jobs/view/123?trk=x');
      expect(result.value.created).toBe(true);
    }
  });

  it('una URL de referencia http es un error de forma (400)', async () => {
    const { importer } = setup();
    const result = await importer.execute({
      text: TEXT,
      referenceUrl: 'http://x.acme-ejemplo.com',
    });
    expect(!result.ok && result.error.code).toBe('VALIDATION_ERROR');
  });

  it('url y text juntos, o ninguno: error de forma', async () => {
    const { importer } = setup();
    expect((await importer.execute({ url: URL_OK, text: TEXT })).ok).toBe(false);
    expect((await importer.execute({})).ok).toBe(false);
  });

  it('el texto debe tener entre 50 y 50 000 caracteres tras recortar', async () => {
    const { importer } = setup();
    expect((await importer.execute({ text: ` ${'a'.repeat(49)} ` })).ok).toBe(false);
    expect((await importer.execute({ text: 'a'.repeat(50) })).ok).toBe(true);
    expect((await importer.execute({ text: 'b'.repeat(50_001) })).ok).toBe(false);
    expect((await importer.execute({ text: 'c'.repeat(50_000) })).ok).toBe(true);
  });

  it('elige la primera fuente que puede atender la URL', async () => {
    const other = jest.fn(() =>
      Promise.resolve(ok(normalized({ source: 'LEVER', sourceKey: 'lever:x:1' }))),
    );
    const { importer, fetchSpy } = setup();
    const repo = new InMemoryRepo();
    const custom = new ImportJobPostingUseCase(
      repo,
      { read: () => Promise.resolve(vocabulary()) },
      [
        { kind: 'LEVER', canHandle: () => false, fetch: other },
        { kind: 'GREENHOUSE', canHandle: () => true, fetch: fetchSpy },
      ],
      new FakeClock(new Date()),
    );
    await custom.execute({ url: URL_OK });
    expect(other).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(importer).toBeDefined();
  });

  it('propaga la falla de la fuente sin guardar nada', async () => {
    const failure = ImportFailure.withHint(
      'not-found',
      'No encontramos esa vacante (puede estar cerrada)',
    );
    const { importer, repo } = setup({ source: { fetch: () => Promise.resolve(fail(failure)) } });
    const result = await importer.execute({ url: URL_OK });
    expect(!result.ok && result.error).toBe(failure);
    expect(repo.rows.size).toBe(0);
  });

  it('un id de ATS inválido es un 422 sin llamar a la fuente', async () => {
    const { importer, fetchSpy } = setup();
    const result = await importer.execute({ url: 'https://jobs.lever.co/acme/ab%00cd' });
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('(c) purga el texto vencido con el reloj antes de importar', async () => {
    const { importer, repo, clock } = setup();
    await importer.execute({ text: TEXT });
    expect(repo.purgeCalls).toEqual([clock.current]);
  });

  it('(d) textPurgeAt = importación + 90 días, y reimportar lo renueva (201 → 200)', async () => {
    const { importer, clock } = setup();
    const first = await importer.execute({ url: URL_OK });
    expect(first.ok && first.value.created).toBe(true);
    const importedAt = clock.current.getTime();
    expect(first.ok && first.value.posting.textPurgeAt).toBe(
      new Date(importedAt + 90 * DAY).toISOString(),
    );

    clock.current = new Date(importedAt + 30 * DAY);
    const second = await importer.execute({ url: URL_OK });
    expect(second.ok && second.value.created).toBe(false);
    expect(second.ok && second.value.posting.id).toBe(first.ok && first.value.posting.id);
    expect(second.ok && second.value.posting.importedAt).toBe(clock.current.toISOString());
    expect(second.ok && second.value.posting.textPurgeAt).toBe(
      new Date(clock.current.getTime() + 90 * DAY).toISOString(),
    );
  });

  it('(f) una descripción de 25 000 caracteres se corta a 20 000 con descriptionTruncated', async () => {
    const { importer } = setup({
      source: {
        fetch: () => Promise.resolve(ok(normalized({ description: 'x'.repeat(25_000) }))),
      },
    });
    const result = await importer.execute({ url: URL_OK });
    expect(result.ok && result.value.posting.description).toHaveLength(20_000);
    expect(result.ok && result.value.posting.descriptionTruncated).toBe(true);
  });

  it('una descripción de 20 000 no se marca como cortada', async () => {
    const { importer } = setup({
      source: {
        fetch: () => Promise.resolve(ok(normalized({ description: 'x'.repeat(20_000) }))),
      },
    });
    const result = await importer.execute({ url: URL_OK });
    expect(result.ok && result.value.posting.descriptionTruncated).toBe(false);
  });

  it('detecta términos con el diccionario y el vocabulario del momento', async () => {
    const { importer } = setup({ vocab: vocabulary('java', 'spring-boot', 'event-store') });
    const result = await importer.execute({
      text: 'Backend con Java, Spring Boot, event-store y Kubernetes en nuestro equipo remoto.',
    });
    expect(result.ok && result.value.posting.detectedTerms).toEqual([
      'java',
      'kubernetes',
      'spring-boot',
      'event-store',
    ]);
  });

  it('el mismo texto con otros espacios reimporta la misma fila', async () => {
    const { importer, repo } = setup();
    await importer.execute({ text: TEXT });
    const again = await importer.execute({ text: `  ${TEXT.replace(/ /g, '  ')}  ` });
    expect(again.ok && again.value.created).toBe(false);
    expect(repo.rows.size).toBe(1);
  });

  it('usa título y empresa dados con el texto pegado', async () => {
    const { importer } = setup();
    const result = await importer.execute({
      text: TEXT,
      title: 'Líder Técnico',
      company: ' Acme ',
    });
    expect(result.ok && result.value.posting.title).toBe('Líder Técnico');
    expect(result.ok && result.value.posting.company).toBe('Acme');
  });
});

describe('List, Get, Delete y Suggest', () => {
  it('(c) list y get purgan con el reloj; después de 91 días no hay descripción pero sí términos', async () => {
    const { importer, list, get, repo, clock } = setup();
    const imported = await importer.execute({ url: URL_OK });
    const id = imported.ok ? imported.value.posting.id : '';

    clock.current = new Date(clock.current.getTime() + 91 * DAY);
    const listed = await list.execute();
    expect(repo.purgeCalls.at(-1)).toEqual(clock.current);
    expect(listed.value[0].description).toBeNull();
    expect(listed.value[0].textPurged).toBe(true);
    expect(listed.value[0].detectedTerms.length).toBeGreaterThan(0);

    const one = await get.execute({ id });
    expect(one.ok && one.value.description).toBeNull();
    expect(repo.purgeCalls).toHaveLength(3); // import + list + get
  });

  it('lista por importedAt descendente', async () => {
    const { importer, list, clock } = setup();
    await importer.execute({ text: TEXT });
    clock.current = new Date(clock.current.getTime() + DAY);
    await importer.execute({ text: `${TEXT} Otra vacante distinta del todo.` });
    const { value } = await list.execute();
    expect(value.map((row) => row.importedAt)).toEqual(
      [...value.map((row) => row.importedAt)].sort().reverse(),
    );
  });

  it('get y delete de un id inexistente dan not found', async () => {
    const { get, del, suggest } = setup();
    expect((await get.execute({ id: 'nope' })).ok).toBe(false);
    expect((await del.execute({ id: 'nope' })).ok).toBe(false);
    expect((await suggest.execute({ id: 'nope' })).ok).toBe(false);
  });

  it('borrar elimina la vacante', async () => {
    const { importer, del, get } = setup();
    const imported = await importer.execute({ url: URL_OK });
    const id = imported.ok ? imported.value.posting.id : '';
    expect((await del.execute({ id })).ok).toBe(true);
    expect((await get.execute({ id })).ok).toBe(false);
  });

  it('(e) la sugerencia usa el vocabulario del momento del GET', async () => {
    const { importer, suggest, setVocab } = setup({ vocab: vocabulary('java', 'spring-boot') });
    const imported = await importer.execute({ url: URL_OK });
    const id = imported.ok ? imported.value.posting.id : '';

    const before = await suggest.execute({ id });
    expect(before.ok && before.value.suggestedFilterTags).toEqual(['java', 'spring-boot']);
    expect(before.ok && before.value.coverage.uncovered).toContain('kubernetes');

    setVocab(vocabulary('java')); // el owner oculta lo que respaldaba spring-boot
    const after = await suggest.execute({ id });
    expect(after.ok && after.value.suggestedFilterTags).toEqual(['java']);
    expect(after.ok && after.value.coverage.uncovered).toContain('spring-boot');
  });

  it('la sugerencia solo trae lo previsto y funciona tras la purga', async () => {
    const { importer, suggest, clock } = setup();
    const imported = await importer.execute({ url: URL_OK });
    const id = imported.ok ? imported.value.posting.id : '';
    clock.current = new Date(clock.current.getTime() + 91 * DAY);
    const result = await suggest.execute({ id });
    expect(result.ok && Object.keys(result.value).sort()).toEqual([
      'coverage',
      'suggestedFilterTags',
      'suggestedSlugBase',
      'suggestedTitle',
    ]);
    expect(result.ok && result.value.suggestedSlugBase).toBe('acme-ejemplo-tech-lead-backend');
    expect(result.ok && result.value.suggestedTitle).toBe('Tech Lead Backend');
  });
});

describe('toJobPostingOutput', () => {
  it('serializa las fechas en ISO y marca textPurged con description nula', () => {
    const date = new Date('2026-11-12T12:00:00.000Z');
    const output = toJobPostingOutput({
      ...normalized(),
      description: null,
      descriptionTruncated: false,
      detectedTerms: ['java'],
      importedAt: date,
      textPurgeAt: new Date(date.getTime() + 90 * DAY),
      postedAt: date,
      id: 'jp1',
      createdAt: date,
      updatedAt: date,
    });
    expect(output.description).toBeNull();
    expect(output.textPurged).toBe(true);
    expect(output.postedAt).toBe('2026-11-12T12:00:00.000Z');
    expect(output.textPurgeAt).toBe('2027-02-10T12:00:00.000Z');
    expect(output).not.toHaveProperty('sourceKey');
  });
});
