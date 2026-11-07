import { Application } from '../../domain/entities/application.entity';
import { ApplicationWithRefs } from '../../domain/repositories/application.repository';
import { toApplicationOutput } from './application.mapper';

const T0 = new Date('2026-11-01T10:00:00Z');

function row(withLink: boolean): ApplicationWithRefs {
  return {
    application: new Application({
      id: 'a1',
      company: 'Globex',
      role: 'Backend Senior',
      jobUrl: null,
      portal: null,
      notes: null,
      status: 'APPLIED',
      appliedAt: '2026-11-01',
      statusChangedAt: T0,
      curatedProfileId: 'cp1',
      shareLinkId: withLink ? 'sl1' : null,
      createdAt: T0,
      updatedAt: T0,
    }),
    profileSlug: 'ejemplo-backend',
    shareLink: withLink ? { id: 'sl1', label: 'Enlace', code: 'abcdefghjk', revoked: true } : null,
  };
}

describe('toApplicationOutput', () => {
  it('fechas en ISO, appliedAt como AAAA-MM-DD y nextStatuses de la tabla', () => {
    const out = toApplicationOutput(row(false), undefined);
    expect(out.statusChangedAt).toBe('2026-11-01T10:00:00.000Z');
    expect(out.createdAt).toBe('2026-11-01T10:00:00.000Z');
    expect(out.appliedAt).toBe('2026-11-01');
    expect(out.profileSlug).toBe('ejemplo-backend');
    expect(out.shareLink).toBeNull();
    expect(out.nextStatuses).toEqual(['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN']);
  });

  it('un enlace sin aperturas queda en 0 y null; revoked viaja', () => {
    const out = toApplicationOutput(row(true), undefined);
    expect(out.shareLink).toEqual({
      id: 'sl1',
      label: 'Enlace',
      code: 'abcdefghjk',
      revoked: true,
      opens: 0,
      firstOpenedAt: null,
      lastOpenedAt: null,
    });
  });

  it('con aperturas, las fechas salen en ISO', () => {
    const out = toApplicationOutput(row(true), {
      shareLinkId: 'sl1',
      opens: 3,
      firstOpenedAt: new Date('2026-11-03T09:00:00Z'),
      lastOpenedAt: new Date('2026-11-05T09:00:00Z'),
    });
    expect(out.shareLink).toMatchObject({
      opens: 3,
      firstOpenedAt: '2026-11-03T09:00:00.000Z',
      lastOpenedAt: '2026-11-05T09:00:00.000Z',
    });
  });

  it('un estado final trae nextStatuses vacío', () => {
    const base = row(false);
    const accepted = {
      ...base,
      application: new Application({
        id: 'a1',
        company: 'x',
        role: 'y',
        jobUrl: null,
        portal: null,
        notes: null,
        status: 'ACCEPTED',
        appliedAt: '2026-11-01',
        statusChangedAt: T0,
        curatedProfileId: null,
        shareLinkId: null,
        createdAt: T0,
        updatedAt: T0,
      }),
    };
    expect(toApplicationOutput(accepted, undefined).nextStatuses).toEqual([]);
  });
});
