import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { makeCuratedProfile, makeExperience } from '@/test/fixtures/curated-profile';
import { ThemeProvider } from '@/themes/theme-provider';
import { PrintableSheet } from './PrintableSheet';

function renderSheet(
  data = makeCuratedProfile(),
  locale: 'es' | 'en' = 'es',
  profileTokens: unknown = data.theme?.tokens ?? null,
) {
  return render(
    <MemoryRouter>
      <ThemeProvider profileTokens={profileTokens}>
        <PrintableSheet data={data} locale={locale} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function sheet(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-print-sheet]');
  if (!el) throw new Error('no hay hoja imprimible');
  return el;
}

describe('PrintableSheet', () => {
  it('lleva data-print-sheet y está oculta en pantalla, visible al imprimir', () => {
    const { container } = renderSheet();
    const el = sheet(container);
    expect(el.classList.contains('hidden')).toBe(true);
    expect(el.classList.contains('print:block')).toBe(true);
  });

  it('no usa motion ni texto con degradé recortado', () => {
    const { container } = renderSheet();
    const el = sheet(container);
    expect(el.querySelector('[data-motion]')).toBeNull();
    expect(el.innerHTML).not.toMatch(/text-transparent|bg-clip-text|text-gradient/);
  });

  it('expone la paleta de papel y la tipografía del perfil en sus variables --t-*', () => {
    const { container } = renderSheet(makeCuratedProfile(), 'es', {
      mode: 'dark',
      colors: { bg: '#0a0e1a', text: '#e8edf5', accent: '#ff8800' },
      typography: { fontSans: 'Merriweather', fontHeading: 'Playfair Display' },
    });
    const el = sheet(container);
    expect(el.style.getPropertyValue('--t-bg')).toBe('#ffffff');
    expect(el.style.getPropertyValue('--t-text')).toBe('#111111');
    expect(el.style.getPropertyValue('--t-accent')).toBe('#ff8800');
    expect(el.style.getPropertyValue('--t-font-sans')).toContain('Merriweather');
    expect(el.style.getPropertyValue('--t-font-heading')).toContain('Playfair Display');
  });

  it('muestra el encabezado y los enlaces como texto visible', () => {
    const { container } = renderSheet();
    const view = within(sheet(container));
    expect(
      view.getByRole('heading', { level: 1, name: 'Ada Ejemplo', hidden: true }),
    ).toBeInTheDocument();
    const email = view.getByRole('link', { name: 'ada@example.com', hidden: true });
    expect(email).toHaveAttribute('href', 'mailto:ada@example.com');
    expect(view.getByText('linkedin.com/in/ada-ejemplo')).toBeInTheDocument();
    expect(view.getByText(/Español · Nativo/)).toBeInTheDocument();
  });

  it('cierra con la URL de la versión completa, sin token', () => {
    const { container } = renderSheet(makeCuratedProfile({ slug: 'dotnet-backend' }), 'en');
    const footer = within(sheet(container)).getByText(/Full version/);
    expect(footer.textContent).toMatch(/\/dotnet-backend\?lang=en$/);
    expect(footer.textContent).not.toMatch(/token/);
  });

  it('muestra los bloques en orden y la línea de omitidos', () => {
    const experiences = Array.from({ length: 13 }, (_, i) =>
      makeExperience({ id: `e${i}`, role: `Rol ${i}`, company: `Empresa ${i}` }),
    );
    const { container } = renderSheet(makeCuratedProfile({ experiences }));
    const view = within(sheet(container));
    expect(view.getByText('y 7 experiencias más')).toBeInTheDocument();
    const labels = Array.from(sheet(container).querySelectorAll('[data-print-block]')).map((el) =>
      el.getAttribute('data-print-block'),
    );
    expect(labels).toEqual([
      'hero',
      'experience',
      'skills',
      'projects',
      'education',
      'certifications',
    ]);
  });

  it('no deja ningún nodo de la hoja sin texto legible (sin etiquetas vacías)', () => {
    const { container } = renderSheet();
    const empty = Array.from(sheet(container).querySelectorAll('li')).filter(
      (li) => !li.textContent?.trim(),
    );
    expect(empty).toEqual([]);
    expect(screen.queryByText('undefined')).toBeNull();
  });
});
