import {
  formatReclassificationReport,
  parseReclassifyArgs,
  planReclassification,
  ProfileRow,
  ViewRow,
} from '../scripts/lib/reclassify-views';
import { describeDatabaseTarget } from '../scripts/lib/seed-guard';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADLESS =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36';

let seq = 0;
const row = (over: Partial<ViewRow> = {}): ViewRow => ({
  id: `v${++seq}`,
  curatedProfileId: 'p1',
  userAgent: CHROME,
  kind: 'HUMAN',
  ...over,
});

/** Aplica el plan a las filas en memoria, como lo haría `--apply` (para probar la idempotencia). */
function applyInMemory(rows: ViewRow[], plan: ReturnType<typeof planReclassification>): ViewRow[] {
  return rows.map((r) =>
    plan.toBot.includes(r.id)
      ? { ...r, kind: 'BOT' as const }
      : plan.toHuman.includes(r.id)
        ? { ...r, kind: 'HUMAN' as const }
        : r,
  );
}

describe('planReclassification', () => {
  const profiles: ProfileRow[] = [{ id: 'p1', slug: 'ejemplo-backend', views: 5 }];

  it('reclasificar bots viejos: 5 HUMAN con 2 HeadlessChrome -> 2 BOT y views 3', () => {
    const rows = [row(), row(), row(), row({ userAgent: HEADLESS }), row({ userAgent: HEADLESS })];
    const plan = planReclassification(rows, profiles);
    expect(plan.toBot).toHaveLength(2);
    expect(plan.toHuman).toHaveLength(0);
    expect(plan.before).toEqual({ HUMAN: 5, OWNER: 0, BOT: 0 });
    expect(plan.after).toEqual({ HUMAN: 3, OWNER: 0, BOT: 2 });
    expect(plan.profileChanges).toEqual([
      { id: 'p1', slug: 'ejemplo-backend', current: 5, expected: 3 },
    ]);
    expect(plan.hasChanges).toBe(true);
  });

  it('una fila sin User-Agent también pasa a BOT', () => {
    const plan = planReclassification(
      [row({ userAgent: null })],
      [{ id: 'p1', slug: 's', views: 1 }],
    );
    expect(plan.toBot).toHaveLength(1);
    expect(plan.profileChanges[0]).toMatchObject({ current: 1, expected: 0 });
  });

  it('las OWNER no se tocan aunque su UA sea de navegador común o de bot, ni suman a views', () => {
    const owner = row({ kind: 'OWNER', userAgent: CHROME });
    const ownerBotUa = row({ kind: 'OWNER', userAgent: HEADLESS });
    const plan = planReclassification(
      [owner, ownerBotUa, row()],
      [{ id: 'p1', slug: 's', views: 1 }],
    );
    expect(plan.toBot).toEqual([]);
    expect(plan.toHuman).toEqual([]);
    expect(plan.after).toEqual({ HUMAN: 1, OWNER: 2, BOT: 0 });
    expect(plan.hasChanges).toBe(false);
  });

  it('una BOT cuyo UA ya no está en la lista vuelve a HUMAN', () => {
    const plan = planReclassification(
      [row({ kind: 'BOT', userAgent: CHROME })],
      [{ id: 'p1', slug: 's', views: 0 }],
    );
    expect(plan.toHuman).toHaveLength(1);
    expect(plan.profileChanges[0]).toMatchObject({ current: 0, expected: 1 });
  });

  it('idempotencia: un plan sobre datos ya reclasificados no tiene cambios', () => {
    const rows = [
      row(),
      row({ userAgent: HEADLESS }),
      row({ userAgent: null }),
      row({ kind: 'OWNER' }),
    ];
    const first = planReclassification(rows, profiles);
    const reclassified = applyInMemory(rows, first);
    const second = planReclassification(reclassified, [
      { ...profiles[0], views: first.profileChanges[0].expected },
    ]);
    expect(second.hasChanges).toBe(false);
    expect(second.toBot).toEqual([]);
    expect(second.toHuman).toEqual([]);
    expect(second.profileChanges).toEqual([]);
  });

  it('views se recalcula por perfil, también el de un perfil sin filas', () => {
    const plan = planReclassification(
      [row({ curatedProfileId: 'p2' })],
      [
        { id: 'p1', slug: 'a', views: 4 },
        { id: 'p2', slug: 'b', views: 1 },
      ],
    );
    expect(plan.profileChanges).toEqual([{ id: 'p1', slug: 'a', current: 4, expected: 0 }]);
  });
});

describe('formatReclassificationReport', () => {
  it('informe completo para una entrada fija', () => {
    const rows = [
      row({ id: 'a' }),
      row({ id: 'b' }),
      row({ id: 'c', userAgent: HEADLESS }),
      row({ id: 'd', kind: 'OWNER' }),
    ];
    const plan = planReclassification(rows, [{ id: 'p1', slug: 'ejemplo-backend', views: 3 }]);
    const report = formatReclassificationReport({
      plan,
      target: 'localhost:5434/portfolio_x',
      apply: false,
      databaseUrl: 'postgresql://usuario:secreto@localhost:5434/portfolio_x?schema=public',
      now: new Date(2026, 9, 28),
    });
    expect(report).toBe(
      [
        'views:reclassify — lista de bots v1',
        'Destino: localhost:5434/portfolio_x',
        'Modo: simulación (no escribe; usá --apply para aplicar)',
        '',
        'Visitas: 4',
        'Antes:   HUMAN 3 · OWNER 1 · BOT 0',
        'Después: HUMAN 2 · OWNER 1 · BOT 1',
        'Cambian de kind: HUMAN → BOT 1 · BOT → HUMAN 0',
        'Visitas de cada perfil (views), actual → nuevo:',
        '  ejemplo-backend: 3 → 2 (-1)',
        '',
        'Antes de aplicar en una base con datos que importen, respaldala (sin contraseña en la línea de comandos):',
        '  pg_dump "postgresql://usuario@localhost:5434/portfolio_x" -Fc -f portfolio_x-2026-10-28.dump',
      ].join('\n'),
    );
  });

  it('sin cambios lo dice y no sugiere respaldo', () => {
    const plan = planReclassification([row()], [{ id: 'p1', slug: 's', views: 1 }]);
    const report = formatReclassificationReport({
      plan,
      target: 'localhost:5434/x',
      apply: true,
    });
    expect(report).toContain('Modo: APLICAR');
    expect(report).toContain('Sin cambios: la base ya está reclasificada.');
    expect(report).not.toContain('pg_dump');
  });

  it('no contiene la contraseña de la URL', () => {
    const databaseUrl =
      'postgresql://usuario:s3creto-Unico@db.interna:5432/portfolio?schema=public';
    const plan = planReclassification(
      [row({ userAgent: HEADLESS })],
      [{ id: 'p1', slug: 's', views: 1 }],
    );
    const report = formatReclassificationReport({
      plan,
      target: describeDatabaseTarget(databaseUrl),
      apply: true,
      databaseUrl,
    });
    expect(report).not.toContain('s3creto-Unico');
    expect(report).toContain('db.interna:5432/portfolio');
  });
});

describe('parseReclassifyArgs', () => {
  it('sin argumentos es simulación; --apply escribe', () => {
    expect(parseReclassifyArgs([])).toEqual({ ok: true, value: { apply: false } });
    expect(parseReclassifyArgs(['--apply'])).toEqual({ ok: true, value: { apply: true } });
  });

  it('un argumento desconocido es un error de uso (código 1 en el script)', () => {
    const parsed = parseReclassifyArgs(['--aplicar']);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('--aplicar');
    expect(parseReclassifyArgs(['--apply', '--otro']).ok).toBe(false);
  });
});
