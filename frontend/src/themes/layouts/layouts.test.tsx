import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '../theme-provider';
import { resolveLayoutName } from './index';
import { ProfileLayout } from './ProfileLayout';
import { renderableSections } from './sections';

function renderLayout(name: string, sections?: string[]) {
  const data = makeCuratedProfile(sections ? { sections } : {});
  return renderWithProviders(
    <ThemeProvider>
      <ProfileLayout name={name} data={data} sections={renderableSections(data.sections)} />
    </ThemeProvider>,
  );
}

describe('resolveLayoutName', () => {
  it('classic/sidebar se respetan; desconocido o vacío → classic', () => {
    expect(resolveLayoutName('sidebar')).toBe('sidebar');
    expect(resolveLayoutName('classic')).toBe('classic');
    expect(resolveLayoutName('timeline-3d')).toBe('classic');
    expect(resolveLayoutName(null)).toBe('classic');
  });
});

describe('layouts', () => {
  it('classic renderiza las secciones en orden en una columna', () => {
    const { container } = renderLayout('classic');
    const root = container.querySelector('[data-layout="classic"]');
    expect(root).not.toBeNull();
    const ids = [...(root?.querySelectorAll('section[id]') ?? [])].map((s) => s.id);
    expect(ids).toEqual([
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

  it('renderiza exactamente las secciones recibidas, sin reordenar ni rellenar', () => {
    const { container } = renderLayout('classic', ['contact', 'hero', 'experience']);
    const ids = [...container.querySelectorAll('[data-layout="classic"] section[id]')].map(
      (s) => s.id,
    );
    expect(ids).toEqual(['contact', 'hero', 'experience']);
  });

  it('sidebar pone hero y contacto en la columna lateral y el resto a la derecha', () => {
    const { container } = renderLayout('sidebar');
    const aside = container.querySelector('[data-layout="sidebar"] aside');
    expect(aside).not.toBeNull();
    const asideIds = [...(aside?.querySelectorAll('section[id]') ?? [])].map((s) => s.id);
    expect(asideIds).toEqual(['hero', 'contact']);
    expect(screen.getByRole('heading', { level: 1, name: 'Ada Ejemplo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Experiencia Profesional' })).toBeInTheDocument();
  });

  it('sidebar declara una sola columna en móvil y las dos de escritorio desde lg (D8)', () => {
    const { container } = renderLayout('sidebar');
    const grid = container.querySelector('[data-layout="sidebar"]');
    // Sin columnas declaradas, la columna implícita mide lo que mide su contenido y se ensancha
    // al revelarse el resto de las secciones (CLS 0,416).
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('lg:grid-cols-[320px_minmax(0,1fr)]');
  });

  it('un layout desconocido cae a classic', () => {
    const { container } = renderLayout('timeline-3d');
    expect(container.querySelector('[data-layout="classic"]')).not.toBeNull();
  });
});
