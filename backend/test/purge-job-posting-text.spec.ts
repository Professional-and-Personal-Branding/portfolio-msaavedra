import { runJobPostingPurge } from '../scripts/lib/purge-job-posting-text';

describe('runJobPostingPurge (spec job-posting-intake — texto de la vacante por 90 días)', () => {
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

  function repoWith(expired: number) {
    return {
      countExpiredText: jest.fn().mockResolvedValue(expired),
      purgeExpiredText: jest.fn().mockResolvedValue(expired),
    };
  }

  describe('con --apply', () => {
    it('imprime la cantidad purgada y sale con 0', async () => {
      const { lines, out } = io();
      const repo = repoWith(2);
      expect(await runJobPostingPurge(repo, now, { apply: true }, out)).toBe(0);
      expect(repo.purgeExpiredText).toHaveBeenCalledWith(now);
      expect(lines).toEqual(['Vacantes purgadas: 2']);
    });

    it('con nada vencido imprime 0 y sale con 0', async () => {
      const { lines, out } = io();
      expect(await runJobPostingPurge(repoWith(0), now, { apply: true }, out)).toBe(0);
      expect(lines).toEqual(['Vacantes purgadas: 0']);
    });

    it('ante un error de base informa y sale con 1', async () => {
      const { errors, out } = io();
      const repo = {
        countExpiredText: jest.fn(),
        purgeExpiredText: jest.fn().mockRejectedValue(new Error('conexión caída')),
      };
      expect(await runJobPostingPurge(repo, now, { apply: true }, out)).toBe(1);
      expect(errors[0]).toContain('conexión caída');
    });
  });

  describe('sin --apply (simulación por defecto)', () => {
    it('informa cuántas purgaría, no escribe y sale con 0', async () => {
      const { lines, out } = io();
      const repo = repoWith(2);
      expect(await runJobPostingPurge(repo, now, { apply: false }, out)).toBe(0);
      expect(repo.countExpiredText).toHaveBeenCalledWith(now);
      expect(repo.purgeExpiredText).not.toHaveBeenCalled();
      expect(lines).toEqual(['Vacantes que se purgarían (simulación; usá --apply): 2']);
    });

    it('con nada vencido imprime 0', async () => {
      const { lines, out } = io();
      expect(await runJobPostingPurge(repoWith(0), now, { apply: false }, out)).toBe(0);
      expect(lines).toEqual(['Vacantes que se purgarían (simulación; usá --apply): 0']);
    });

    it('ante un error de base informa y sale con 1', async () => {
      const { errors, out } = io();
      const repo = {
        countExpiredText: jest.fn().mockRejectedValue(new Error('conexión caída')),
        purgeExpiredText: jest.fn(),
      };
      expect(await runJobPostingPurge(repo, now, { apply: false }, out)).toBe(1);
      expect(errors[0]).toContain('conexión caída');
    });
  });
});
