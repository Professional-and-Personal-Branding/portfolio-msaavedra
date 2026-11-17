import { readFileSync } from 'fs';
import { join } from 'path';
import { assertLlmSafe } from '../../domain/data-boundary/data-boundary';
import { prepareTaskRun } from '../services/prepare-task-run';
import { AI_TASKS } from './registry';

const EXAMPLE_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'docs',
  'examples',
  'cv-data.example.json',
);
const exampleCv = JSON.parse(readFileSync(EXAMPLE_PATH, 'utf-8')) as {
  profile: { email: string; phone: string };
} & Record<string, unknown>;

/**
 * Lista negra, capa 3 (D13): para CADA tarea registrada, `buildInput` sobre los datos ficticios del
 * ejemplo (con el email y el teléfono del perfil cargados) produce un payload que pasa el guardián y
 * en el que no aparecen ni el email ni el teléfono ni los secretos de la configuración.
 */
describe('frontera de datos de cada tarea registrada', () => {
  const secrets = ['jwt-secret-de-prueba-1234567890', 'sal-de-analitica-1234'];

  it('el ejemplo trae un email y un teléfono para que la comprobación valga', () => {
    expect(exampleCv.profile.email).toMatch(/@/);
    expect(exampleCv.profile.phone.length).toBeGreaterThan(5);
  });

  it.each(AI_TASKS.map((task) => [task.id, task] as const))(
    '%s: el payload pasa el guardián y no contiene el email ni el teléfono',
    (_id, task) => {
      const payload = task.buildInput(task.sampleSource(exampleCv));
      const safe = assertLlmSafe(payload, secrets);
      expect(safe.ok).toBe(true);
      const prepared = prepareTaskRun(task, task.sampleSource(exampleCv), secrets);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;
      const sent = `${prepared.value.request.system}\n${prepared.value.request.user}`;
      expect(sent).not.toContain(exampleCv.profile.email);
      expect(sent).not.toContain(exampleCv.profile.phone);
      for (const secret of secrets) expect(sent).not.toContain(secret);
    },
  );

  it('autocontrol: un constructor que sí filtra el email es bloqueado', () => {
    const leaky = { structured: { contacto: exampleCv.profile.email }, freeText: {} };
    expect(assertLlmSafe(leaky, secrets).ok).toBe(false);
    const keyed = { structured: { email: 'x' }, freeText: {} };
    expect(assertLlmSafe(keyed, secrets).ok).toBe(false);
  });
});
