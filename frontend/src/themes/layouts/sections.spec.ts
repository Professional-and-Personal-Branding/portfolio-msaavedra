import { describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { hasData, KNOWN_SECTIONS, orderSections } from './sections';

describe('orderSections', () => {
  it('respeta el orden de la API', () => {
    const data = makeCuratedProfile({
      projects: [],
      socialLinks: [],
      education: [],
      certifications: [],
    });
    const result = orderSections(['hero', 'skills', 'experience', 'contact'], [], data);
    expect(result.slice(0, 4)).toEqual(['hero', 'skills', 'experience', 'contact']);
    // stats es conocida, tiene datos y no está listada → al final
    expect(result).toEqual(['hero', 'skills', 'experience', 'contact', 'stats']);
  });

  it('agrega al final las conocidas no listadas, en orden canónico', () => {
    const data = makeCuratedProfile();
    const seedOrder = [
      'hero',
      'stats',
      'experience',
      'skills',
      'education',
      'certifications',
      'contact',
    ];
    const result = orderSections(seedOrder, [], data);

    expect(result.slice(0, 7)).toEqual(seedOrder);
    expect(result.slice(7)).toEqual(['projects', 'presence']);
  });

  it('omite ocultas y vacías', () => {
    const data = makeCuratedProfile({ projects: [] });
    const result = orderSections(['hero', 'stats', 'projects', 'experience'], ['stats'], data);

    expect(result).not.toContain('stats');
    expect(result).not.toContain('projects');
    expect(result[0]).toBe('hero');
    expect(result[1]).toBe('experience');
  });

  it('ignora secciones desconocidas y duplicadas', () => {
    const data = makeCuratedProfile();
    const result = orderSections(['hero', 'timeline-3d', 'hero', 'skills'], [], data);
    expect(result.filter((s) => s === 'hero')).toHaveLength(1);
    expect(result).not.toContain('timeline-3d');
  });

  it('una sección oculta no reaparece al final', () => {
    const data = makeCuratedProfile();
    expect(orderSections(['hero'], ['presence', 'projects'], data)).not.toContain('presence');
  });
});

describe('hasData', () => {
  it('evalúa cada sección conocida', () => {
    const full = makeCuratedProfile();
    for (const section of KNOWN_SECTIONS) expect(hasData(section, full), section).toBe(true);

    const empty = makeCuratedProfile({
      profile: null,
      experiences: [],
      skillCategories: [],
      projects: [],
      education: [],
      certifications: [],
      socialLinks: [],
    });
    for (const section of KNOWN_SECTIONS) expect(hasData(section, empty), section).toBe(false);
  });
});
