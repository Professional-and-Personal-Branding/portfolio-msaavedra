import { Clock } from '../../../../shared/domain/clock';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  ProfileViewRepository,
  ShareLinkOpens,
} from '../../../analytics/domain/repositories/profile-view.repository';
import { ApplicationStatus } from '../../domain/application-status';
import {
  Application,
  ApplicationProps,
  NewApplicationProps,
} from '../../domain/entities/application.entity';
import { ApplicationNotFoundError } from '../../domain/errors/application-not-found.error';
import { InvalidApplicationTransitionError } from '../../domain/errors/invalid-application-transition.error';
import { ShareLinkAlreadyTrackedError } from '../../domain/errors/share-link-already-tracked.error';
import {
  ApplicationReferenceReader,
  ReferencedShareLink,
} from '../../domain/repositories/application-reference.reader';
import {
  ApplicationRepository,
  ApplicationWithRefs,
} from '../../domain/repositories/application.repository';
import {
  CreateApplicationUseCase,
  DeleteApplicationUseCase,
  ExportApplicationsUseCase,
  GetApplicationSummaryUseCase,
  GetApplicationUseCase,
  ListApplicationsUseCase,
  UpdateApplicationUseCase,
} from './application.use-cases';

type CreateResult = Result<ApplicationWithRefs, ShareLinkAlreadyTrackedError>;

const T0 = new Date('2026-11-01T10:00:00Z');
const NOW = new Date('2026-11-20T15:30:00Z');
const clock: Clock = { now: () => NOW };

function props(over: Partial<ApplicationProps> = {}): ApplicationProps {
  return {
    id: 'a1',
    company: 'Globex',
    role: 'Backend Senior',
    jobUrl: null,
    portal: null,
    notes: null,
    status: 'APPLIED',
    appliedAt: '2026-11-01',
    statusChangedAt: T0,
    curatedProfileId: null,
    shareLinkId: null,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

function row(
  over: Partial<ApplicationProps> = {},
  slug: string | null = null,
): ApplicationWithRefs {
  const application = new Application(props(over));
  return {
    application,
    profileSlug: slug,
    shareLink: application.shareLinkId
      ? { id: application.shareLinkId, label: 'Enlace', code: 'abcdefghjk', revoked: false }
      : null,
  };
}

const LINK: ReferencedShareLink = {
  id: 'sl1',
  curatedProfileId: 'cp1',
  kind: 'MANUAL',
  label: 'Globex — RR. HH.',
  code: 'abcdefghjk',
  revokedAt: null,
};

/** Repositorios simulados: lo justo para observar qué escriben y cuántas veces consultan. */
function build(
  rows: ApplicationWithRefs[] = [],
  opts: { profiles?: string[]; links?: ReferencedShareLink[]; tracked?: string[] } = {},
) {
  const store = new Map(rows.map((r) => [r.application.id, r]));
  const applications = {
    list: jest.fn((filter: { statuses?: readonly ApplicationStatus[] }) =>
      Promise.resolve(
        [...store.values()].filter(
          (r) => !filter.statuses?.length || filter.statuses.includes(r.application.status),
        ),
      ),
    ),
    findById: jest.fn((id: string) => Promise.resolve(store.get(id) ?? null)),
    create: jest.fn((p: NewApplicationProps): Promise<CreateResult> =>
      Promise.resolve(
        ok({
          application: new Application({ ...p, id: 'new', createdAt: NOW, updatedAt: NOW }),
          profileSlug: null,
          shareLink: p.shareLinkId
            ? { id: p.shareLinkId, label: 'Enlace', code: 'abcdefghjk', revoked: false }
            : null,
        }),
      ),
    ),
    update: jest.fn((application: Application) =>
      Promise.resolve(ok({ application, profileSlug: null, shareLink: null })),
    ),
    delete: jest.fn((id: string) => Promise.resolve(store.delete(id))),
    countByStatus: jest.fn(() => Promise.resolve({})),
    isShareLinkTracked: jest.fn((id: string) => Promise.resolve((opts.tracked ?? []).includes(id))),
  } satisfies ApplicationRepository;
  const references = {
    findProfile: jest.fn((id: string) =>
      Promise.resolve((opts.profiles ?? ['cp1']).includes(id) ? { id, slug: `slug-${id}` } : null),
    ),
    findShareLink: jest.fn((id: string) =>
      Promise.resolve((opts.links ?? [LINK]).find((l) => l.id === id) ?? null),
    ),
  } satisfies ApplicationReferenceReader;
  const views = {
    countOpensByShareLink: jest.fn((): Promise<ShareLinkOpens[]> => Promise.resolve([])),
  };
  return {
    applications,
    references,
    views,
    list: new ListApplicationsUseCase(applications, views as unknown as ProfileViewRepository),
    get: new GetApplicationUseCase(applications, views as unknown as ProfileViewRepository),
    create: new CreateApplicationUseCase(
      applications,
      references,
      views as unknown as ProfileViewRepository,
      clock,
    ),
    update: new UpdateApplicationUseCase(
      applications,
      references,
      views as unknown as ProfileViewRepository,
      clock,
    ),
    remove: new DeleteApplicationUseCase(applications),
    summary: new GetApplicationSummaryUseCase(applications),
    exporter: new ExportApplicationsUseCase(
      applications,
      views as unknown as ProfileViewRepository,
      clock,
    ),
  };
}

const NEW = { company: 'Globex', role: 'Backend Senior' };

describe('ListApplicationsUseCase (D8)', () => {
  it('pide las aperturas UNA vez con todos los ids no nulos', async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ id: `a${i}`, shareLinkId: i < 7 ? `sl${i}` : null }),
    );
    const t = build(rows);
    const list = await t.list.execute({});
    expect(list).toHaveLength(10);
    expect(t.views.countOpensByShareLink).toHaveBeenCalledTimes(1);
    expect(t.views.countOpensByShareLink).toHaveBeenCalledWith([
      'sl0',
      'sl1',
      'sl2',
      'sl3',
      'sl4',
      'sl5',
      'sl6',
    ]);
    expect(t.applications.list).toHaveBeenCalledTimes(1);
  });

  it('no pide aperturas si ninguna postulación tiene enlace', async () => {
    const t = build([row({ id: 'a1' }), row({ id: 'a2' })]);
    await t.list.execute({});
    expect(t.views.countOpensByShareLink).not.toHaveBeenCalled();
  });

  it('completa opens, firstOpenedAt y lastOpenedAt; sin visitas queda en 0 y null', async () => {
    const t = build([row({ id: 'a1', shareLinkId: 'sl1' }), row({ id: 'a2', shareLinkId: 'sl2' })]);
    t.views.countOpensByShareLink.mockResolvedValue([
      {
        shareLinkId: 'sl1',
        opens: 2,
        firstOpenedAt: new Date('2026-11-03T09:00:00Z'),
        lastOpenedAt: new Date('2026-11-05T09:00:00Z'),
      },
    ]);
    const [first, second] = await t.list.execute({});
    expect(first.shareLink).toMatchObject({
      opens: 2,
      firstOpenedAt: '2026-11-03T09:00:00.000Z',
      lastOpenedAt: '2026-11-05T09:00:00.000Z',
    });
    expect(second.shareLink).toMatchObject({ opens: 0, firstOpenedAt: null, lastOpenedAt: null });
  });

  it('pasa el filtro de estados al repositorio y trae nextStatuses', async () => {
    const t = build([row({ id: 'a1', status: 'APPLIED' }), row({ id: 'a2', status: 'REJECTED' })]);
    const list = await t.list.execute({ statuses: ['APPLIED'] });
    expect(t.applications.list).toHaveBeenCalledWith({ statuses: ['APPLIED'] });
    expect(list.map((a) => a.id)).toEqual(['a1']);
    expect(list[0].nextStatuses).toEqual(['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN']);
  });
});

describe('GetApplicationUseCase', () => {
  it('id inexistente → ApplicationNotFoundError', async () => {
    const result = await build().get.execute({ id: 'nope' });
    expect(!result.ok && result.error).toBeInstanceOf(ApplicationNotFoundError);
  });

  it('una postulación con enlace pide las aperturas con un solo id', async () => {
    const t = build([row({ shareLinkId: 'sl1' })]);
    await t.get.execute({ id: 'a1' });
    expect(t.views.countOpensByShareLink).toHaveBeenCalledWith(['sl1']);
  });
});

describe('CreateApplicationUseCase (D7)', () => {
  it('crea con el reloj: statusChangedAt y appliedAt salen de NOW', async () => {
    const t = build();
    const result = await t.create.execute({ ...NEW, status: 'APPLIED' });
    expect(result.ok).toBe(true);
    const written = t.applications.create.mock.calls[0][0];
    expect(written.statusChangedAt).toEqual(NOW);
    expect(written.appliedAt).toBe('2026-11-20');
  });

  it('campos inválidos → ValidationError sin escribir', async () => {
    const t = build();
    const result = await t.create.execute({ company: '', role: 'x' });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.create).not.toHaveBeenCalled();
  });

  it('perfil inexistente → ValidationError sin escribir', async () => {
    const t = build();
    const result = await t.create.execute({ ...NEW, curatedProfileId: 'zzz' });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.create).not.toHaveBeenCalled();
  });

  it('enlace de otro perfil → ValidationError sin escribir', async () => {
    const t = build([], { profiles: ['cp1', 'cp2'] });
    const result = await t.create.execute({ ...NEW, curatedProfileId: 'cp2', shareLinkId: 'sl1' });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.create).not.toHaveBeenCalled();
  });

  it('enlace LINKEDIN_POST → ValidationError sin escribir', async () => {
    const t = build([], { links: [{ ...LINK, kind: 'LINKEDIN_POST' }] });
    const result = await t.create.execute({ ...NEW, curatedProfileId: 'cp1', shareLinkId: 'sl1' });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.create).not.toHaveBeenCalled();
  });

  it('enlace sin perfil → ValidationError sin escribir', async () => {
    const t = build();
    const result = await t.create.execute({ ...NEW, shareLinkId: 'sl1' });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.create).not.toHaveBeenCalled();
  });

  it('enlace inexistente → ValidationError sin escribir', async () => {
    const t = build([], { links: [] });
    const result = await t.create.execute({ ...NEW, curatedProfileId: 'cp1', shareLinkId: 'sl1' });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.create).not.toHaveBeenCalled();
  });

  it('enlace revocado del perfil se acepta', async () => {
    const t = build([], { links: [{ ...LINK, revokedAt: T0 }] });
    const result = await t.create.execute({ ...NEW, curatedProfileId: 'cp1', shareLinkId: 'sl1' });
    expect(result.ok).toBe(true);
  });

  it('enlace ya rastreado → ShareLinkAlreadyTrackedError sin escribir', async () => {
    const t = build([], { tracked: ['sl1'] });
    const result = await t.create.execute({ ...NEW, curatedProfileId: 'cp1', shareLinkId: 'sl1' });
    expect(!result.ok && result.error).toBeInstanceOf(ShareLinkAlreadyTrackedError);
    expect(t.applications.create).not.toHaveBeenCalled();
  });

  it('si la unicidad salta en la escritura, propaga el conflicto', async () => {
    const t = build();
    t.applications.create.mockResolvedValueOnce(fail(new ShareLinkAlreadyTrackedError()));
    const result = await t.create.execute({ ...NEW, curatedProfileId: 'cp1', shareLinkId: 'sl1' });
    expect(!result.ok && result.error).toBeInstanceOf(ShareLinkAlreadyTrackedError);
  });
});

describe('UpdateApplicationUseCase (D9)', () => {
  it('id inexistente → ApplicationNotFoundError', async () => {
    const result = await build().update.execute({ id: 'nope', notes: 'x' });
    expect(!result.ok && result.error).toBeInstanceOf(ApplicationNotFoundError);
  });

  it('transición inválida con otros campos → error y no llama a update', async () => {
    const t = build([row({ status: 'DRAFT', appliedAt: null })]);
    const result = await t.update.execute({ id: 'a1', notes: 'nueva', status: 'OFFER' });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidApplicationTransitionError);
    expect(t.applications.update).not.toHaveBeenCalled();
  });

  it('cambia notas y estado en una sola escritura con el reloj', async () => {
    const t = build([row({ status: 'APPLIED' })]);
    const result = await t.update.execute({ id: 'a1', notes: 'llamaron', status: 'INTERVIEWING' });
    expect(result.ok).toBe(true);
    expect(t.applications.update).toHaveBeenCalledTimes(1);
    const saved = t.applications.update.mock.calls[0][0];
    expect(saved.notes).toBe('llamaron');
    expect(saved.status).toBe('INTERVIEWING');
    expect(saved.statusChangedAt).toEqual(NOW);
  });

  it('salir de DRAFT sin fecha la fija con el reloj', async () => {
    const t = build([row({ status: 'DRAFT', appliedAt: null })]);
    await t.update.execute({ id: 'a1', status: 'APPLIED' });
    expect(t.applications.update.mock.calls[0][0].appliedAt).toBe('2026-11-20');
  });

  it('el mismo estado no cambia statusChangedAt', async () => {
    const t = build([row({ status: 'APPLIED' })]);
    await t.update.execute({ id: 'a1', status: 'APPLIED', notes: 'x' });
    expect(t.applications.update.mock.calls[0][0].statusChangedAt).toEqual(T0);
  });

  it('un campo inválido → ValidationError sin escribir', async () => {
    const t = build([row()]);
    const result = await t.update.execute({ id: 'a1', jobUrl: 'ftp://x' });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.update).not.toHaveBeenCalled();
  });

  it('quitar el perfil sin quitar el enlace → ValidationError', async () => {
    const t = build([row({ curatedProfileId: 'cp1', shareLinkId: 'sl1' })]);
    const result = await t.update.execute({ id: 'a1', curatedProfileId: null });
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError);
    expect(t.applications.update).not.toHaveBeenCalled();
  });

  it('quitar perfil y enlace juntos se acepta', async () => {
    const t = build([row({ curatedProfileId: 'cp1', shareLinkId: 'sl1' })]);
    const result = await t.update.execute({ id: 'a1', curatedProfileId: null, shareLinkId: null });
    expect(result.ok).toBe(true);
  });

  it('un enlace tomado por otra postulación → ShareLinkAlreadyTrackedError', async () => {
    const t = build([row({ curatedProfileId: 'cp1' })], { tracked: ['sl1'] });
    const result = await t.update.execute({ id: 'a1', shareLinkId: 'sl1' });
    expect(!result.ok && result.error).toBeInstanceOf(ShareLinkAlreadyTrackedError);
    expect(t.applications.isShareLinkTracked).toHaveBeenCalledWith('sl1', 'a1');
  });

  it('un PATCH que no toca los vínculos no consulta el lector de referencias', async () => {
    const t = build([row({ curatedProfileId: 'cp1', shareLinkId: 'sl1' })]);
    await t.update.execute({ id: 'a1', notes: 'x' });
    expect(t.references.findProfile).not.toHaveBeenCalled();
    expect(t.references.findShareLink).not.toHaveBeenCalled();
  });
});

describe('DeleteApplicationUseCase', () => {
  it('borra y luego da ApplicationNotFoundError', async () => {
    const t = build([row()]);
    expect((await t.remove.execute({ id: 'a1' })).ok).toBe(true);
    const again = await t.remove.execute({ id: 'a1' });
    expect(!again.ok && again.error).toBeInstanceOf(ApplicationNotFoundError);
  });
});

describe('GetApplicationSummaryUseCase', () => {
  it('completa los siete estados con ceros y calcula active', async () => {
    const t = build();
    t.applications.countByStatus.mockResolvedValue({ APPLIED: 2, OFFER: 1, REJECTED: 3 });
    expect(await t.summary.execute()).toEqual({
      byStatus: {
        DRAFT: 0,
        APPLIED: 2,
        INTERVIEWING: 0,
        OFFER: 1,
        ACCEPTED: 0,
        REJECTED: 3,
        WITHDRAWN: 0,
      },
      active: 3,
    });
  });

  it('sin filas: todo en cero', async () => {
    const result = await build().summary.execute();
    expect(result.active).toBe(0);
    expect(Object.keys(result.byStatus)).toHaveLength(7);
  });
});

describe('ExportApplicationsUseCase (D10)', () => {
  it('el nombre lleva la fecha UTC del reloj y el CSV parte con BOM y la cabecera', async () => {
    const t = build([row({ company: '=1+1' })]);
    const { filename, csv } = await t.exporter.execute({ statuses: ['APPLIED'] });
    expect(filename).toBe('postulaciones-2026-11-20.csv');
    expect(csv.startsWith('﻿"Empresa","Puesto","Estado"')).toBe(true);
    expect(csv).toContain('"\'=1+1"');
    expect(t.applications.list).toHaveBeenCalledWith({ statuses: ['APPLIED'] });
  });
});
