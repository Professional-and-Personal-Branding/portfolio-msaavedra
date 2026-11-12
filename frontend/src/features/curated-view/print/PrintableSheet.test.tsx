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
      'repositories',
      'education',
      'certifications',
    ]);
  });

  it('la línea de repositorios: rótulo en línea, nombres enlazados y sin imprimir la URL', () => {
    const { container } = renderSheet(makeCuratedProfile());
    const block = sheet(container).querySelector('[data-print-block="repositories"]');
    expect(block).not.toBeNull();
    expect(block?.querySelectorAll('p')).toHaveLength(1);
    expect(block?.textContent).toBe('Repositorios: reservas-api · metricas-dashboard');
    const links = [...(block?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      'https://github.com/ejemplo/reservas-api',
      'https://github.com/ejemplo/metricas-dashboard',
    ]);
    expect(block?.textContent).not.toContain('github.com');
    expect(sheet(container).querySelector('[data-motion]')).toBeNull();
  });

  it('«Ver credencial» es un enlace con su href en el bloque de certificaciones, sin motion', () => {
    const base = makeCuratedProfile().certifications[0]!;
    const data = makeCuratedProfile({
      certifications: [
        { ...base, verificationUrl: 'https://example.org/credenciales/1', expiresAt: '2000-01' },
      ],
    });
    const { container } = renderSheet(data);
    const block = within(sheet(container))
      .getByText(/AWS Solutions Architect/)
      .closest('p');
    const link = within(block as HTMLElement).getByRole('link', {
      name: 'Ver credencial',
      hidden: true,
    });
    expect(link).toHaveAttribute('href', 'https://example.org/credenciales/1');
    expect(block?.textContent).toContain('vencida');
    expect(block?.textContent).not.toContain('example.org');
    expect(sheet(container).querySelector('[data-motion]')).toBeNull();
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
