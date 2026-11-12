import { runJobPostingPurge } from '../scripts/lib/purge-job-posting-text';

describe('runJobPostingPurge', () => {
  const now = new Date('2026-11-12T12:00:00.000Z');

  function io() {
    const lines: string[] = [];
    const errors: string[] = [];
    return {
      lines,
      errors,
      out: { log: (l: string) => lines.push(l), error: (l: string) => errors.push(l) },
    };
  }

  it('imprime la cantidad purgada y sale con 0', async () => {
    const { lines, out } = io();
    const repo = { purgeExpiredText: jest.fn().mockResolvedValue(2) };
    expect(await runJobPostingPurge(repo, now, out)).toBe(0);
    expect(repo.purgeExpiredText).toHaveBeenCalledWith(now);
    expect(lines).toEqual(['Texto de vacantes purgado: 2']);
  });

  it('con nada vencido imprime 0 y sale con 0', async () => {
    const { lines, out } = io();
    const repo = { purgeExpiredText: jest.fn().mockResolvedValue(0) };
    expect(await runJobPostingPurge(repo, now, out)).toBe(0);
    expect(lines).toEqual(['Texto de vacantes purgado: 0']);
  });

  it('ante un error de base informa y sale con 1', async () => {
    const { errors, out } = io();
    const repo = { purgeExpiredText: jest.fn().mockRejectedValue(new Error('conexión caída')) };
    expect(await runJobPostingPurge(repo, now, out)).toBe(1);
    expect(errors[0]).toContain('conexión caída');
  });
});
