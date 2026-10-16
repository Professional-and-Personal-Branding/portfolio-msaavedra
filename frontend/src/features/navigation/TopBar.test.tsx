import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { listProductionSources } from '@/test/source-files';
import { ThemeProvider } from '@/themes/theme-provider';
import { TopBar } from './TopBar';

// D3 de `improve-mobile-performance`: los menús (Radix + Floating UI) no viajan en el arranque.
describe('TopBar — menús en diferido', () => {
  it('nadie importa ThemeSwitcher ni ProfileMenu de forma estática, salvo sus propios tests', () => {
    const staticImport = /from\s+['"][^'"]*\/(ThemeSwitcher|ProfileMenu)['"]/;
    const offenders = listProductionSources()
      .filter(({ text }) => staticImport.test(text))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('los carga con import() dinámico desde lazy-menus', () => {
    const lazy = listProductionSources().find(({ path }) =>
      path.endsWith('navigation/lazy-menus.ts'),
    );
    expect(lazy?.text).toMatch(/import\('\.\/ThemeSwitcher'\)/);
    expect(lazy?.text).toMatch(/import\('\.\/ProfileMenu'\)/);
  });

  it('muestra los disparadores desde el primer render, antes de que cargue ningún menú', () => {
    renderWithProviders(
      <ThemeProvider>
        <TopBar activeSlug="all" layout="classic" showProfileMenu menusReady={false} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Tema' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.getByRole('button', { name: 'Perfiles' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
  });
});
