import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MotionSection } from './motion-section';
import { ThemeProvider } from './theme-provider';
import { useTheme } from './use-theme';

function Probe() {
  const { tokens, source, preset, animationsEnabled } = useTheme();
  return (
    <output data-testid="probe">
      {[tokens.colors.accent, source, preset?.slug ?? '-', String(animationsEnabled)].join('|')}
    </output>
  );
}

function rootOf(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>('[data-theme]');
  if (!root) throw new Error('sin contenedor raíz');
  return root;
}

describe('ThemeProvider', () => {
  it('aplica los tokens del perfil como variables --t-* en el contenedor raíz', () => {
    const { container } = render(
      <ThemeProvider profileTokens={{ colors: { accent: '#ff0000' } }}>
        <Probe />
      </ThemeProvider>,
    );
    const root = rootOf(container);

    expect(root.style.getPropertyValue('--t-accent')).toBe('#ff0000');
    expect(root.style.getPropertyValue('--t-bg')).toBe('#0a0e1a');
    expect(root.style.colorScheme).toBe('dark');
    expect(root).toHaveClass('dark');
    expect(screen.getByTestId('probe')).toHaveTextContent('#ff0000|profile|-|true');
    expect(document.documentElement.style.getPropertyValue('--t-accent')).toBe('');
  });

  it('cambia de tema sin remontar el árbol', () => {
    const { container, rerender } = render(
      <ThemeProvider presetSlug="modern-dark">
        <Probe />
      </ThemeProvider>,
    );
    const root = rootOf(container);
    const probe = screen.getByTestId('probe');

    rerender(
      <ThemeProvider presetSlug="modern-light">
        <Probe />
      </ThemeProvider>,
    );

    expect(root.style.getPropertyValue('--t-bg')).toBe('#f8fafc');
    expect(root.style.getPropertyValue('--t-text')).toBe('#0f172a');
    expect(root).not.toHaveClass('dark');
    expect(screen.getByTestId('probe')).toBe(probe);
    expect(probe).toHaveTextContent('preset|modern-light');
  });

  it('el preset elegido prevalece sobre el tema del perfil; uno desconocido se ignora', () => {
    const { rerender } = render(
      <ThemeProvider profileTokens={{ colors: { accent: '#ff0000' } }} presetSlug="elegant">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('#c8a04e|preset|elegant');

    rerender(
      <ThemeProvider profileTokens={{ colors: { accent: '#ff0000' } }} presetSlug="neon">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('#ff0000|profile|-');
  });

  it('sin tokens usa modern-dark', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('#38bdf8|default|-');
  });

  it('con animations=false las secciones no se animan', () => {
    const { container } = render(
      <ThemeProvider presetSlug="minimal">
        <MotionSection>contenido</MotionSection>
      </ThemeProvider>,
    );
    expect(container.querySelector('section')).toHaveAttribute('data-motion', 'off');
  });

  it('con animations=true las secciones se animan', () => {
    const { container } = render(
      <ThemeProvider presetSlug="modern-dark">
        <MotionSection>contenido</MotionSection>
      </ThemeProvider>,
    );
    expect(container.querySelector('section')).toHaveAttribute('data-motion', 'on');
  });
});
