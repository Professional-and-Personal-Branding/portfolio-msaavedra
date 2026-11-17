import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { aiSmokeTask } from './ai-smoke.task';
import { AnyAiTask, loadPrompt, normalizePromptText, PROMPTS_DIR, promptSha256 } from './ai-task';
import { AI_TASKS, taskDefinitionIssues } from './registry';

const base = aiSmokeTask as unknown as AnyAiTask;

describe('registro de tareas', () => {
  it('toda tarea registrada es válida', () => {
    for (const task of AI_TASKS) expect(taskDefinitionIssues(task)).toEqual([]);
  });

  it('rechaza Opus (fuera del registro, P2)', () => {
    const opus = { ...base, model: 'claude-opus-5-5' } as unknown as AnyAiTask;
    expect(taskDefinitionIssues(opus)).toEqual(
      expect.arrayContaining([expect.stringContaining('fuera del registro')]),
    );
  });

  it('rechaza thinking apagado con effort xhigh o max', () => {
    expect(taskDefinitionIssues({ ...base, effort: 'xhigh' })).toHaveLength(1);
    expect(taskDefinitionIssues({ ...base, effort: 'max' })).toHaveLength(1);
    expect(taskDefinitionIssues({ ...base, effort: 'high' })).toEqual([]);
    expect(taskDefinitionIssues({ ...base, thinking: 'adaptive', effort: 'max' })).toEqual([]);
  });

  it('la tarea de humo usa Haiku 5.5, effort low, thinking apagado y 256 tokens', () => {
    expect(aiSmokeTask).toMatchObject({
      id: 'ai.smoke',
      model: 'claude-haiku-5-5',
      effort: 'low',
      thinking: 'off',
      maxTokens: 256,
    });
    expect(aiSmokeTask.outputSchema.safeParse({ estado: 'ok' }).success).toBe(true);
    expect(aiSmokeTask.outputSchema.safeParse({ estado: 'no' }).success).toBe(false);
    expect(z.toJSONSchema(aiSmokeTask.outputSchema)).toBeDefined();
  });
});

describe('prompts versionados (D12)', () => {
  it('el hash registrado de cada tarea coincide con su archivo', () => {
    for (const task of AI_TASKS) {
      const text = readFileSync(join(PROMPTS_DIR, task.id, `v${task.promptVersion}.md`), 'utf-8');
      expect({ task: task.id, sha: promptSha256(text) }).toEqual({
        task: task.id,
        sha: task.promptSha256,
      });
    }
  });

  it('cada archivo de prompts corresponde a una tarea y versión registradas', () => {
    const files = readdirSync(PROMPTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) =>
        readdirSync(join(PROMPTS_DIR, d.name)).map((f) => ({ task: d.name, file: f })),
      );
    expect(files.length).toBeGreaterThan(0);
    for (const { task, file } of files) {
      const registered = AI_TASKS.find((t) => t.id === task);
      expect(registered).toBeDefined();
      // Las versiones viejas pueden conservarse (D12): solo exigimos que la vigente exista.
      expect(file).toMatch(/^v\d+\.md$/);
    }
    for (const task of AI_TASKS) {
      expect(existsSync(join(PROMPTS_DIR, task.id, `v${task.promptVersion}.md`))).toBe(true);
    }
  });

  it('autocontrol: un texto alterado cambia el hash y loadPrompt falla nombrando la tarea', () => {
    const original = readFileSync(join(PROMPTS_DIR, 'ai.smoke', 'v1.md'), 'utf-8');
    expect(promptSha256(`${original}\nAgregado`)).not.toBe(aiSmokeTask.promptSha256);
    expect(() => loadPrompt('ai.smoke', 1, 'deadbeef')).toThrow(/ai\.smoke/);
  });

  it('el hash no depende de los saltos de línea (CRLF vs LF)', () => {
    expect(promptSha256('a\r\nb')).toBe(promptSha256('a\nb'));
    expect(normalizePromptText('a\r\nb')).toBe('a\nb');
  });
});
