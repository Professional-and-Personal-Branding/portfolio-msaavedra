import { describe, expect, it } from 'vitest';
import { formatCount } from './plural';

describe('formatCount', () => {
  const proyectos = { one: 'proyecto', other: 'proyectos' };
  const projects = { one: 'project', other: 'projects' };

  it('en español: 0 y 2 van en plural, 1 en singular', () => {
    expect(formatCount(0, proyectos)).toBe('0 proyectos');
    expect(formatCount(1, proyectos)).toBe('1 proyecto');
    expect(formatCount(2, proyectos)).toBe('2 proyectos');
  });

  it('en inglés: 0 y 2 van en plural, 1 en singular', () => {
    expect(formatCount(0, projects, 'en')).toBe('0 projects');
    expect(formatCount(1, projects, 'en')).toBe('1 project');
    expect(formatCount(2, projects, 'en')).toBe('2 projects');
  });

  it('el idioma por defecto es español', () => {
    expect(formatCount(1, proyectos)).toBe(formatCount(1, proyectos, 'es'));
  });
});
