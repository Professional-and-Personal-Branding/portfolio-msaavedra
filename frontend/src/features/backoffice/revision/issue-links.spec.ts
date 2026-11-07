import { describe, expect, it } from 'vitest';
import type { CvEntityType } from '../shared/admin-types';
import { issueHref } from './issue-links';

describe('issueHref (D12)', () => {
  // Los diez tipos de entidad del contrato: si el backend suma uno, `Record` no compila.
  const expected: Record<CvEntityType, string> = {
    profile: '/admin/portada',
    language: '/admin/portada',
    experience: '/admin/experiencias?editar=abc',
    skillCategory: '/admin/skills?editar=abc',
    skill: '/admin/skills?editar=abc',
    education: '/admin/formacion?editar=abc',
    certification: '/admin/formacion?editar=abc',
    project: '/admin/proyectos?editar=abc',
    socialLink: '/admin/proyectos?editar=abc',
    curatedProfile: '/admin/perfiles/abc',
  };

  it.each(Object.entries(expected) as Array<[CvEntityType, string]>)('%s → %s', (type, href) => {
    expect(issueHref(type, 'abc')).toBe(href);
  });

  it('cubre los diez tipos', () => {
    expect(Object.keys(expected)).toHaveLength(10);
  });

  it('codifica el id en la URL', () => {
    expect(issueHref('experience', 'a b&c=d')).toBe('/admin/experiencias?editar=a%20b%26c%3Dd');
    expect(issueHref('curatedProfile', 'a/b')).toBe('/admin/perfiles/a%2Fb');
  });
});
