import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '@/themes/theme-provider';
import { Repositories } from './Repositories';

// add-featured-repositories (D8): tarjetas con nombre enlazado, lenguaje opcional y tecnologías.
const [FIRST, SECOND] = makeCuratedProfile().repositories as [
  ReturnType<typeof makeCuratedProfile>['repositories'][number],
  ReturnType<typeof makeCuratedProfile>['repositories'][number],
];

function renderSection(repositories = [FIRST, SECOND], route = '/') {
  return renderWithProviders(
    <ThemeProvider>
      <Repositories data={makeCuratedProfile({ repositories })} />
    </ThemeProvider>,
    { route },
  );
}

describe('Repositories — sección pública', () => {
  it('muestra el título, una tarjeta por repositorio y el id #repositories', () => {
    const { container } = renderSection();
    expect(container.querySelector('section#repositories')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Repositorios destacados' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('listitem').filter((li) => li.className.includes('surface')),
    ).toHaveLength(2);
  });

  it('cada nombre es un enlace a su URL de GitHub, en pestaña nueva y sin filtrar el opener', () => {
    renderSection();
    const link = screen.getByRole('link', { name: /reservas-api/ });
    expect(link).toHaveAttribute('href', FIRST.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('el nombre accesible incluye el repositorio y es distinto en cada tarjeta', () => {
    renderSection();
    const names = screen.getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['reservas-api — Ver en GitHub', 'metricas-dashboard — Ver en GitHub']);
  });

  it('en inglés, el nombre accesible usa «View on GitHub»', () => {
    renderSection([FIRST, SECOND], '/?lang=en');
    expect(screen.getByRole('link', { name: 'reservas-api — View on GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Featured Repositories' })).toBeVisible();
  });

  it('muestra la descripción, el lenguaje y las tecnologías', () => {
    renderSection();
    const card = screen.getByRole('link', { name: /reservas-api/ }).closest('li') as HTMLElement;
    expect(within(card).getByText('API de reservas con Spring Boot.')).toBeVisible();
    expect(within(card).getByText('Java')).toBeInTheDocument();
    expect(within(card).getByText('Spring Boot')).toBeVisible();
    expect(within(card).getByText('PostgreSQL')).toBeVisible();
  });

  it('sin lenguaje no hay etiqueta ni valor vacío', () => {
    renderSection();
    const card = screen
      .getByRole('link', { name: /metricas-dashboard/ })
      .closest('li') as HTMLElement;
    expect(within(card).queryByText(/Lenguaje/)).toBeNull();
    expect(card.querySelector('p.text-text-dim')).toBeNull();
  });

  it('no carga recursos de otros orígenes: solo enlaces de navegación', () => {
    const { container } = renderSection();
    expect(container.querySelectorAll('img, iframe, script, link[rel="stylesheet"]')).toHaveLength(
      0,
    );
  });
});
