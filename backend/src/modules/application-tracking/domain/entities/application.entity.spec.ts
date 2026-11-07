import {
  ACTIVE_APPLICATION_STATUSES,
  APPLICATION_STATUSES,
  APPLICATION_TRANSITIONS,
  ApplicationStatus,
} from '../application-status';
import { InvalidApplicationTransitionError } from '../errors/invalid-application-transition.error';
import { Application, buildNewApplication, NewApplicationInput } from './application.entity';

const T0 = new Date('2026-11-01T10:00:00Z');
const NOW = new Date('2026-11-20T15:30:00Z');

function app(status: ApplicationStatus, appliedAt: string | null = '2026-11-01'): Application {
  return new Application({
    id: 'a1',
    company: 'Globex',
    role: 'Backend Senior',
    jobUrl: null,
    portal: null,
    notes: null,
    status,
    appliedAt: status === 'DRAFT' ? null : appliedAt,
    statusChangedAt: T0,
    curatedProfileId: null,
    shareLinkId: null,
    createdAt: T0,
    updatedAt: T0,
  });
}

const BASE: NewApplicationInput = { company: 'Globex', role: 'Backend Senior' };

describe('Application — máquina de estados (D4)', () => {
  const VALID: [ApplicationStatus, ApplicationStatus][] = [];
  const INVALID: [ApplicationStatus, ApplicationStatus][] = [];
  for (const from of APPLICATION_STATUSES) {
    for (const to of APPLICATION_STATUSES) {
      if (from === to) continue;
      (APPLICATION_TRANSITIONS[from].includes(to) ? VALID : INVALID).push([from, to]);
    }
  }

  it('cubre las 49 combinaciones: 7 iguales, 14 válidas y 28 inválidas', () => {
    expect(APPLICATION_STATUSES).toHaveLength(7);
    expect(VALID).toHaveLength(14);
    expect(INVALID).toHaveLength(28);
    expect(VALID.length + INVALID.length + APPLICATION_STATUSES.length).toBe(49);
  });

  it.each(VALID)('%s → %s es válida y fija un statusChangedAt nuevo', (from, to) => {
    const result = app(from).transitionTo(to, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(to);
    expect(result.value.statusChangedAt).toEqual(NOW);
  });

  it.each(INVALID)('%s → %s da InvalidApplicationTransitionError y no cambia nada', (from, to) => {
    const original = app(from);
    const result = original.transitionTo(to, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(InvalidApplicationTransitionError);
    expect(result.error.message).toBe(`Transición de estado inválida: ${from} → ${to}`);
    expect(original.status).toBe(from);
    expect(original.statusChangedAt).toEqual(T0);
  });

  it.each(APPLICATION_STATUSES.map((s) => [s] as const))(
    '%s → el mismo estado es un no-op sin tocar statusChangedAt',
    (status) => {
      const original = app(status);
      const result = original.transitionTo(status, NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe(original);
      expect(result.value.statusChangedAt).toEqual(T0);
    },
  );

  it('nextStatuses sale de la tabla, por estado', () => {
    expect(app('DRAFT').nextStatuses()).toEqual(['APPLIED', 'WITHDRAWN']);
    expect(app('APPLIED').nextStatuses()).toEqual([
      'INTERVIEWING',
      'OFFER',
      'REJECTED',
      'WITHDRAWN',
    ]);
    expect(app('INTERVIEWING').nextStatuses()).toEqual(['OFFER', 'REJECTED', 'WITHDRAWN']);
    expect(app('OFFER').nextStatuses()).toEqual(['ACCEPTED', 'REJECTED', 'WITHDRAWN']);
    expect(app('ACCEPTED').nextStatuses()).toEqual([]);
    expect(app('REJECTED').nextStatuses()).toEqual(['APPLIED']);
    expect(app('WITHDRAWN').nextStatuses()).toEqual(['APPLIED']);
  });

  it('las activas son DRAFT, APPLIED, INTERVIEWING y OFFER', () => {
    expect([...ACTIVE_APPLICATION_STATUSES]).toEqual(['DRAFT', 'APPLIED', 'INTERVIEWING', 'OFFER']);
  });
});

describe('Application — appliedAt (D4)', () => {
  it('es nula con DRAFT y se fija sola al salir de DRAFT con el día UTC del reloj', () => {
    const draft = buildNewApplication(BASE, NOW);
    expect(draft.ok && draft.value.appliedAt).toBeNull();
    const result = app('DRAFT').transitionTo('APPLIED', NOW);
    expect(result.ok && result.value.appliedAt).toBe('2026-11-20');
  });

  it('al crear fuera de DRAFT sin fecha toma el día UTC del reloj', () => {
    const result = buildNewApplication({ ...BASE, status: 'APPLIED' }, NOW);
    expect(result.ok && result.value.appliedAt).toBe('2026-11-20');
  });

  it('reabrir no cambia la fecha', () => {
    const result = app('REJECTED', '2026-11-03').transitionTo('APPLIED', NOW);
    expect(result.ok && result.value.appliedAt).toBe('2026-11-03');
  });

  it('DRAFT con fecha explícita se rechaza (también con withAppliedAt)', () => {
    expect(buildNewApplication({ ...BASE, appliedAt: '2026-11-10' }, NOW).ok).toBe(false);
    expect(app('DRAFT').withAppliedAt('2026-11-10', NOW).ok).toBe(false);
  });

  it('el día del reloj + 1 se acepta y + 2 no', () => {
    const ok1 = buildNewApplication({ ...BASE, status: 'APPLIED', appliedAt: '2026-11-21' }, NOW);
    expect(ok1.ok && ok1.value.appliedAt).toBe('2026-11-21');
    const bad = buildNewApplication({ ...BASE, status: 'APPLIED', appliedAt: '2026-11-22' }, NOW);
    expect(bad.ok).toBe(false);
    expect(app('APPLIED').withAppliedAt('2026-11-21', NOW).ok).toBe(true);
    expect(app('APPLIED').withAppliedAt('2026-11-22', NOW).ok).toBe(false);
  });

  it('rechaza una fecha que no es de calendario', () => {
    for (const raw of ['2026-02-30', '2026-13-01', '20-11-2026', 'ayer']) {
      expect(buildNewApplication({ ...BASE, status: 'APPLIED', appliedAt: raw }, NOW).ok).toBe(
        false,
      );
    }
  });

  it('fuera de DRAFT, withAppliedAt(null) se rechaza', () => {
    expect(app('APPLIED').withAppliedAt(null, NOW).ok).toBe(false);
  });
});

describe('buildNewApplication', () => {
  it('estado inicial DRAFT por omisión y statusChangedAt del reloj', () => {
    const result = buildNewApplication(BASE, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('DRAFT');
    expect(result.value.statusChangedAt).toEqual(NOW);
    expect(result.value.curatedProfileId).toBeNull();
    expect(result.value.shareLinkId).toBeNull();
  });

  it('propaga el error de los campos', () => {
    expect(buildNewApplication({ company: '  ', role: 'x' }, NOW).ok).toBe(false);
  });
});
