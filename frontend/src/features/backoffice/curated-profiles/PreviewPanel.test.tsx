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
});
