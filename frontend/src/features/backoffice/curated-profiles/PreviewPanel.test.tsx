import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { DEFAULT_TOKENS } from '@/themes/tokens';
import { PreviewPanel } from './PreviewPanel';

// D1 de `improve-mobile-performance`: el revelado en dos tiempos es de la vista pública
// (`CuratedProfileView`); el preview del constructor renderiza todo de una.
describe('PreviewPanel', () => {
  it('el primer render con datos tiene todas las secciones, sin relleno de pantalla', () => {
    const sections = ['hero', 'stats', 'experience', 'skills', 'contact'];
    const { container } = renderWithProviders(
      <PreviewPanel
        data={makeCuratedProfile({ sections })}
        tokens={DEFAULT_TOKENS}
        layout="classic"
        isFetching={false}
        error={null}
        locale="es"
        onLocaleChange={() => undefined}
      />,
    );

    const canvas = container.querySelector('[data-testid="preview-canvas"]');
    expect([...(canvas?.querySelectorAll('section[id]') ?? [])].map((s) => s.id)).toEqual(sections);
    expect(canvas?.querySelector('[aria-hidden="true"].min-h-screen')).toBeNull();
  });

  // D5 y D6 de `polish-views-updated-at-and-builder`: los contadores concuerdan en número y
  // quedan en español aunque el preview muestre el contenido en inglés.
  describe('contadores', () => {
    const base = makeCuratedProfile();
    /** Perfil con esa cantidad de experiencias, categorías y proyectos (el fixture trae 2, 2 y 1). */
    const withCounts = (experiences: number, categories: number, projects: number) => ({
      ...base,
      experiences: base.experiences.slice(0, experiences),
      skillCategories: Array.from({ length: categories }, (_, i) => ({
        name: `Categoría ${i}`,
        skills: [],
      })),
      projects: base.projects.slice(0, projects),
    });
    const renderCounts = (
      data: ReturnType<typeof makeCuratedProfile>,
      locale: 'es' | 'en' = 'es',
    ) =>
      renderWithProviders(
        <PreviewPanel
          data={data}
          tokens={DEFAULT_TOKENS}
          layout="classic"
          isFetching={false}
          error={null}
          locale={locale}
          onLocaleChange={() => undefined}
        />,
      );

    it('con 1 de cada uno, usa el singular', () => {
      renderCounts(withCounts(1, 1, 1));

      expect(screen.getByTestId('preview-counts').textContent).toBe(
        '1 experiencia · 1 categoría · 1 proyecto',
      );
    });

    it('con 2, 3 y 0, usa el plural (el 0 también)', () => {
      renderCounts(withCounts(2, 3, 0));

      expect(screen.getByTestId('preview-counts').textContent).toBe(
        '2 experiencias · 3 categorías · 0 proyectos',
      );
    });

    it('con el preview en inglés, el contador sigue en español', () => {
      renderCounts(withCounts(1, 1, 1), 'en');

      expect(screen.getByTestId('preview-counts').textContent).toContain('1 proyecto');
    });
  });
});
