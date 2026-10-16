import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceTimeline } from '@/shared/components/portfolio/ExperienceTimeline';
import { Hero } from '@/shared/components/portfolio/Hero';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { MotionSection } from './motion-section';
import { ThemeProvider } from './theme-provider';

const animateOnEnter = vi.fn<(element: HTMLElement, delay: number) => () => void>();
let loadAnimation: () => { animateOnEnter: typeof animateOnEnter };

// El módulo de animación se pide con `import()` dentro del efecto: se controla cuándo llega.
vi.mock('./entrance-animation', () => ({
  get animateOnEnter() {
    return loadAnimation().animateOnEnter;
  },
}));

beforeEach(() => {
  animateOnEnter.mockReset();
  animateOnEnter.mockImplementation(() => () => undefined);
  loadAnimation = () => ({ animateOnEnter });
});
afterEach(() => vi.unstubAllGlobals());

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function renderExperience(preset = 'modern-dark') {
  const data = makeCuratedProfile();
  return renderWithProviders(
    <ThemeProvider presetSlug={preset}>
      <ExperienceTimeline data={data} />
    </ThemeProvider>,
  );
}

describe('MotionSection — animación de entrada sin remontar (D7)', () => {
  it('el nodo de #experience y los de su contenido son los mismos antes y después de cargar el módulo', async () => {
    const { container } = renderExperience();
    const section = container.querySelector('#experience');
    const title = screen.getByRole('heading', { name: 'Experiencia Profesional' });
    const company = screen.getByText('Acme Corp');
    expect(section).toHaveAttribute('data-motion', 'on');
    expect(animateOnEnter).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(animateOnEnter).toHaveBeenCalledTimes(1));

    expect(container.querySelector('#experience')).toBe(section);
    expect(screen.getByRole('heading', { name: 'Experiencia Profesional' })).toBe(title);
    expect(screen.getByText('Acme Corp')).toBe(company);
    expect(animateOnEnter).toHaveBeenCalledWith(section, expect.any(Number));
  });

  it('con effects.animations = false no se anima ni se pide el módulo', async () => {
    const { container } = renderExperience('minimal');

    expect(container.querySelector('#experience')).toHaveAttribute('data-motion', 'off');
    await act(() => Promise.resolve());
    expect(animateOnEnter).not.toHaveBeenCalled();
  });

  it('con prefers-reduced-motion: reduce tampoco', async () => {
    mockReducedMotion(true);
    const { container } = renderExperience();

    expect(container.querySelector('#experience')).toHaveAttribute('data-motion', 'off');
    await act(() => Promise.resolve());
    expect(animateOnEnter).not.toHaveBeenCalled();
  });

  it('un re-render tras la entrada no la quita ni repite la animación', async () => {
    const { container, rerender } = render(
      <ThemeProvider presetSlug="modern-dark">
        <MotionSection id="demo">uno</MotionSection>
      </ThemeProvider>,
    );
    await vi.waitFor(() => expect(animateOnEnter).toHaveBeenCalledTimes(1));
    // Lo que deja `animateOnEnter` al terminar.
    const section = container.querySelector('#demo');
    section?.setAttribute('data-motion-entered', '');

    rerender(
      <ThemeProvider presetSlug="modern-dark">
        <MotionSection id="demo">dos</MotionSection>
      </ThemeProvider>,
    );

    expect(container.querySelector('#demo')).toBe(section);
    expect(section).toHaveAttribute('data-motion-entered');
    expect(section).toHaveTextContent('dos');
    expect(animateOnEnter).toHaveBeenCalledTimes(1);
  });

  it('si el módulo de animación no carga, la sección queda marcada como vista (visible)', async () => {
    loadAnimation = () => {
      throw new Error('chunk inaccesible');
    };
    const { container } = render(
      <ThemeProvider presetSlug="modern-dark">
        <MotionSection id="demo">contenido</MotionSection>
      </ThemeProvider>,
    );

    await vi.waitFor(() =>
      expect(container.querySelector('#demo')).toHaveAttribute('data-motion-entered'),
    );
  });
});

describe('MotionSection — content-visibility (D2)', () => {
  it('las secciones animadas se omiten fuera de pantalla y el hero no', () => {
    const data = makeCuratedProfile();
    const { container } = renderWithProviders(
      <ThemeProvider presetSlug="modern-dark">
        <Hero data={data} />
        <ExperienceTimeline data={data} />
      </ThemeProvider>,
    );

    const experience = container.querySelector('#experience');
    expect(experience).toHaveClass('[content-visibility:auto]');
    expect(experience).toHaveClass('[contain-intrinsic-size:auto_640px]');
    const hero = container.querySelector('#hero');
    expect(hero?.className).not.toContain('content-visibility');
    expect(hero?.className).not.toContain('contain-intrinsic-size');
  });

  it('también las que tienen las animaciones apagadas', () => {
    const { container } = renderExperience('minimal');
    expect(container.querySelector('#experience')).toHaveClass('[content-visibility:auto]');
  });
});
