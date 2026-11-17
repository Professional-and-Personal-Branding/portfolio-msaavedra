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

// add-github-code-evidence (D10): stars (desde 1), lenguajes con porcentaje, topics, archivado,
// último cambio y sello «Verificado en GitHub el…». Sin evidencia, la tarjeta no cambia.
type Evidence = NonNullable<typeof FIRST.evidence>;

const EVIDENCE: Evidence = {
  stars: 12,
  languages: [
    { name: 'Java', percent: 82 },
    { name: 'CSS', percent: 12 },
    { name: 'HTML', percent: 6 },
  ],
  topics: ['api-rest', 'postgresql'],
  pushedAt: '2026-10-30T12:00:00.000Z',
  archived: false,
  verifiedAt: '2026-11-16T10:00:00.000Z',
};

const cardOf = (name: RegExp): HTMLElement =>
  screen.getByRole('link', { name }).closest('li') as HTMLElement;

describe('Repositories — evidencia verificada contra GitHub', () => {
  const verified = { ...FIRST, evidence: EVIDENCE };

  it('muestra las stars con nombre accesible, los lenguajes con porcentaje y los topics', () => {
    renderSection([verified, SECOND]);
    const card = cardOf(/reservas-api/);
    expect(within(card).getByText('12 stars en GitHub')).toBeInTheDocument();
    expect(within(card).getByText('Java 82 % · CSS 12 % · HTML 6 %')).toBeVisible();
    const topics = within(card).getByRole('list', { name: 'Temas' });
    expect(
      within(topics)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['api-rest', 'postgresql']);
  });

  it('el número de stars no se anuncia dos veces: solo el texto accesible', () => {
    renderSection([verified, SECOND]);
    const card = cardOf(/reservas-api/);
    const visibleNumber = within(card).getByText('12');
    expect(visibleNumber).toHaveAttribute('aria-hidden', 'true');
  });

  it('muestra el último cambio y el sello con la fecha de verificación', () => {
    renderSection([verified, SECOND]);
    const card = cardOf(/reservas-api/);
    expect(within(card).getByText('Último cambio: oct 2026')).toBeVisible();
    expect(within(card).getByText('Verificado en GitHub el 16 nov 2026')).toBeVisible();
  });

  it('con 0 stars no hay contador, pero sí el sello de verificación', () => {
    renderSection([{ ...FIRST, evidence: { ...EVIDENCE, stars: 0 } }, SECOND]);
    const card = cardOf(/reservas-api/);
    expect(within(card).queryByText(/stars/)).toBeNull();
    expect(card.querySelector('svg.lucide-star')).toBeNull();
    expect(within(card).getByText(/Verificado en GitHub el/)).toBeVisible();
  });

  it('un repositorio archivado lo dice con texto; uno activo no', () => {
    const archived = renderSection([
      { ...FIRST, evidence: { ...EVIDENCE, archived: true } },
      SECOND,
    ]);
    expect(within(cardOf(/reservas-api/)).getByText('Archivado')).toBeVisible();
    archived.unmount();
    renderSection([verified, SECOND]);
    expect(within(cardOf(/reservas-api/)).queryByText('Archivado')).toBeNull();
  });

  it('sin último push no hay «Último cambio», y sin topics ni lenguajes no hay listas vacías', () => {
    renderSection([
      { ...FIRST, evidence: { ...EVIDENCE, pushedAt: null, topics: [], languages: [] } },
      SECOND,
    ]);
    const card = cardOf(/reservas-api/);
    expect(within(card).queryByText(/Último cambio/)).toBeNull();
    expect(within(card).queryByRole('list', { name: 'Temas' })).toBeNull();
    expect(within(card).queryByText(/Lenguajes/)).toBeNull();
    expect(within(card).getByText(/Verificado en GitHub el/)).toBeVisible();
  });

  it('en inglés usa los rótulos y el formato de fecha en inglés', () => {
    renderSection([{ ...FIRST, evidence: { ...EVIDENCE, archived: true } }, SECOND], '/?lang=en');
    const card = cardOf(/reservas-api/);
    expect(within(card).getByText('12 stars on GitHub')).toBeInTheDocument();
    expect(within(card).getByText('Verified on GitHub on Nov 16, 2026')).toBeVisible();
    expect(within(card).getByText('Last change: Oct 2026')).toBeVisible();
    expect(within(card).getByText('Archived')).toBeVisible();
    expect(within(card).getByText('Java 82% · CSS 12% · HTML 6%')).toBeVisible();
    expect(within(card).getByRole('list', { name: 'Topics' })).toBeInTheDocument();
  });

  it('sin evidencia la tarjeta es idéntica a la de antes: nada de stars, topics ni sello', () => {
    const withNull = renderSection([FIRST, SECOND]);
    const html = cardOf(/reservas-api/).innerHTML;
    expect(html).not.toMatch(/GitHub el|stars|lucide-star|Archivado|Temas/);
    // Solo el lenguaje y la descripción como párrafos.
    expect(cardOf(/reservas-api/).querySelectorAll('p')).toHaveLength(2);
    withNull.unmount();

    // `evidence` ausente (una respuesta vieja del servidor) se ve igual que `null`.
    const legacy: Partial<typeof FIRST> = { ...FIRST };
    delete legacy.evidence;
    renderSection([legacy as typeof FIRST, SECOND]);
    expect(cardOf(/reservas-api/).innerHTML).toBe(html);
  });

  it('con evidencia tampoco carga recursos de otros orígenes', () => {
    const { container } = renderSection([verified, SECOND]);
    expect(
      container.querySelectorAll('img, iframe, script, link[rel="stylesheet"], video, audio'),
    ).toHaveLength(0);
  });
});
