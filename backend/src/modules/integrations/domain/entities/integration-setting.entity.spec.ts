import { IntegrationSetting, isProviderStale } from './integration-setting.entity';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const HOUR = 3_600_000;
const transient = { kind: 'Transient', message: 'x' } as const;

function fresh(): IntegrationSetting {
  return IntegrationSetting.initial('fake', NOW);
}

describe('IntegrationSetting', () => {
  describe('breaker', () => {
    it('4 Transient seguidos no pausan', () => {
      let s = fresh();
      for (let i = 0; i < 4; i++) s = s.recordFailure(transient, NOW, () => 0.5);
      expect(s.props.consecutiveFailures).toBe(4);
      expect(s.props.pausedUntil).toBeNull();
      expect(s.isClaimable(NOW)).toBe(true);
    });

    it('el 5.º abre el breaker con nextRetryDelay(5)', () => {
      let s = fresh();
      for (let i = 0; i < 5; i++) s = s.recordFailure(transient, NOW, () => 0.5);
      // 30 s * 2^4 = 480 s; con random 0,5 → 240 s.
      expect(s.props.pausedUntil).toEqual(new Date(NOW.getTime() + 240_000));
      expect(s.props.pauseReason).toBe('CircuitOpen');
      expect(s.isClaimable(NOW)).toBe(false);
      expect(s.isClaimable(new Date(NOW.getTime() + 240_000))).toBe(true);
    });

    it('si falla en el semiabierto vuelve a abrir con el intento siguiente', () => {
      let s = fresh();
      for (let i = 0; i < 6; i++) s = s.recordFailure(transient, NOW, () => 0.5);
      expect(s.props.consecutiveFailures).toBe(6);
      expect(s.props.pausedUntil).toEqual(new Date(NOW.getTime() + 480_000));
    });

    it('un éxito cierra el breaker y levanta la pausa', () => {
      let s = fresh();
      for (let i = 0; i < 5; i++) s = s.recordFailure(transient, NOW, () => 0.5);
      s = s.recordSuccess(NOW);
      expect(s.props).toMatchObject({
        consecutiveFailures: 0,
        pausedUntil: null,
        pauseReason: null,
        lastSuccessAt: NOW,
      });
    });

    it('un Permanent no mueve el breaker', () => {
      const s = fresh().recordFailure({ kind: 'Permanent', message: 'x' }, NOW);
      expect(s.props.consecutiveFailures).toBe(0);
      expect(s.props.pausedUntil).toBeNull();
    });
  });

  describe('pausa por pista del tercero', () => {
    it('RetryAfter pausa hasta ahora + segundos', () => {
      const s = fresh().recordFailure({ kind: 'RetryAfter', seconds: 90, message: 'x' }, NOW);
      expect(s.props.pausedUntil).toEqual(new Date(NOW.getTime() + 90_000));
      expect(s.props.pauseReason).toBe('RetryAfter');
    });

    it('ResetAt pausa hasta esa fecha', () => {
      const at = new Date(NOW.getTime() + HOUR);
      const s = fresh().recordFailure({ kind: 'ResetAt', at, message: 'x' }, NOW);
      expect(s.props.pausedUntil).toEqual(at);
      expect(s.props.pauseReason).toBe('ResetAt');
    });

    it('BudgetExhausted con resetAt pausa hasta esa fecha; sin resetAt no pausa', () => {
      const at = new Date(NOW.getTime() + 24 * HOUR);
      expect(
        fresh().recordFailure({ kind: 'BudgetExhausted', resetAt: at, message: 'x' }, NOW).props
          .pausedUntil,
      ).toEqual(at);
      expect(
        fresh().recordFailure({ kind: 'BudgetExhausted', message: 'x' }, NOW).props.pausedUntil,
      ).toBeNull();
    });
  });

  describe('kill switch', () => {
    it('pausado a mano no es reclamable; al reanudar reinicia enabledSince', () => {
      const later = new Date(NOW.getTime() + 100 * HOUR);
      const paused = fresh().withEnabled(false, NOW);
      expect(paused.isClaimable(NOW)).toBe(false);
      const resumed = paused.withEnabled(true, later);
      expect(resumed.isClaimable(later)).toBe(true);
      expect(resumed.props.enabledSince).toEqual(later);
    });
  });
});

describe('isProviderStale', () => {
  const s = (patch: Partial<ConstructorParameters<typeof IntegrationSetting>[0]>) =>
    new IntegrationSetting({ ...fresh().props, ...patch });

  it('a 47 h del último éxito no está atrasado; a 49 h sí', () => {
    expect(isProviderStale(s({ lastSuccessAt: new Date(NOW.getTime() - 47 * HOUR) }), NOW)).toBe(
      false,
    );
    expect(isProviderStale(s({ lastSuccessAt: new Date(NOW.getTime() - 49 * HOUR) }), NOW)).toBe(
      true,
    );
  });

  it('sin éxitos, cuenta desde enabledSince', () => {
    expect(isProviderStale(s({ enabledSince: new Date(NOW.getTime() - 47 * HOUR) }), NOW)).toBe(
      false,
    );
    expect(isProviderStale(s({ enabledSince: new Date(NOW.getTime() - 49 * HOUR) }), NOW)).toBe(
      true,
    );
  });

  it('un proveedor pausado a mano no se marca', () => {
    expect(
      isProviderStale(
        s({ enabled: false, lastSuccessAt: new Date(NOW.getTime() - 200 * HOUR) }),
        NOW,
      ),
    ).toBe(false);
  });

  it('uno pausado por el breaker sí se marca', () => {
    expect(
      isProviderStale(
        s({
          lastSuccessAt: new Date(NOW.getTime() - 60 * HOUR),
          pausedUntil: new Date(NOW.getTime() + HOUR),
          pauseReason: 'CircuitOpen',
        }),
        NOW,
      ),
    ).toBe(true);
  });
});
