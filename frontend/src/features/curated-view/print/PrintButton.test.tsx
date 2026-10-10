import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from '@/features/navigation/TopBar';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '@/themes/theme-provider';

const withTheme = (ui: ReactNode) => <ThemeProvider>{ui}</ThemeProvider>;

describe('TopBar — botón de imprimir', () => {
  it('sin onPrint no muestra el botón', () => {
    renderWithProviders(withTheme(<TopBar activeSlug="demo" layout="classic" />));
    expect(screen.queryByRole('button', { name: /imprimir|print/i })).toBeNull();
  });

  it('con onPrint muestra el botón con su nombre accesible en español', async () => {
    const onPrint = vi.fn();
    renderWithProviders(
      withTheme(<TopBar activeSlug="demo" layout="classic" onPrint={onPrint} />),
      {
        route: '/demo?lang=es',
      },
    );
    const button = screen.getByRole('button', { name: 'Imprimir / Guardar PDF' });
    await userEvent.click(button);
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it('el nombre accesible sale en inglés con ?lang=en', () => {
    renderWithProviders(
      withTheme(<TopBar activeSlug="demo" layout="classic" onPrint={() => undefined} />),
      {
        route: '/demo?lang=en',
      },
    );
    expect(screen.getByRole('button', { name: 'Print / Save as PDF' })).toBeInTheDocument();
  });

  it('la barra no se imprime', () => {
    const { container } = renderWithProviders(
      withTheme(<TopBar activeSlug="demo" layout="classic" onPrint={() => undefined} />),
    );
    expect(container.querySelector('header')?.classList.contains('print:hidden')).toBe(true);
  });
});
