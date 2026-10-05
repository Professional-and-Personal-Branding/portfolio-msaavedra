import { describe, expect, it } from 'vitest';
import { isSectionId, renderableSections, SECTION_IDS } from './sections';

describe('SECTION_IDS', () => {
  it('es el catálogo del contrato, en orden canónico', () => {
    expect(SECTION_IDS).toEqual([
      'hero',
      'stats',
      'experience',
      'skills',
      'projects',
      'education',
      'certifications',
      'presence',
      'contact',
    ]);
  });

  it('isSectionId reconoce solo ids del catálogo', () => {
    expect(isSectionId('presence')).toBe(true);
    expect(isSectionId('timeline-3d')).toBe(false);
    expect(isSectionId('toString')).toBe(false);
  });
});

// unify-section-catalog: el orden final lo decide el backend (spec `layout-engine`).
describe('renderableSections', () => {
  it('devuelve exactamente lo recibido, en ese orden', () => {
    expect(renderableSections(['hero', 'experience', 'projects'])).toEqual([
      'hero',
      'experience',
      'projects',
    ]);
  });

  it('no reordena', () => {
    const order = ['contact', 'hero', 'skills', 'stats'];
    expect(renderableSections(order)).toEqual(order);
  });

  it('no agrega secciones que la API no mandó', () => {
    expect(renderableSections(['hero'])).toEqual(['hero']);
    expect(renderableSections([])).toEqual([]);
  });

  it('omite un id desconocido sin romper el resto', () => {
    expect(renderableSections(['hero', 'timeline-3d', 'skills'])).toEqual(['hero', 'skills']);
  });
});
