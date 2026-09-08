import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '../theme-provider';
import { resolveLayoutName } from './index';
import { ProfileLayout } from './ProfileLayout';
import { orderSections } from './sections';

function renderLayout(name: string) {
  const data = makeCuratedProfile();
  const sections = orderSections(data.sections, data.hiddenSections, data);
  return renderWithProviders(
    <ThemeProvider>
      <ProfileLayout name={name} data={data} sections={sections} />
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
      'education',
      'certifications',
      'contact',
      'projects',
      'presence',
    ]);
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

  it('un layout desconocido cae a classic', () => {
    const { container } = renderLayout('timeline-3d');
    expect(container.querySelector('[data-layout="classic"]')).not.toBeNull();
  });
});
