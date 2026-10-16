import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tooltip, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { listProductionSources } from '@/test/source-files';
import { AppProviders } from './providers';

// D3 de `improve-mobile-performance`: el arranque público no trae Radix Tooltip; el
// `TooltipProvider` vive en la raíz del panel.
describe('AppProviders', () => {
  it('no monta un TooltipProvider (un Tooltip sin proveedor falla)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <AppProviders>
          <Tooltip>
            <TooltipTrigger>algo</TooltipTrigger>
          </Tooltip>
        </AppProviders>,
      ),
    ).toThrow(/TooltipProvider/);
    error.mockRestore();
  });

  it('TooltipProvider solo aparece en la raíz del panel y en su propio componente', () => {
    const files = listProductionSources()
      .filter(({ text }) => text.includes('TooltipProvider'))
      .map(({ path }) => path);

    expect(files.sort()).toEqual([
      'src/features/backoffice/BackofficeApp.tsx',
      'src/shared/components/ui/tooltip.tsx',
    ]);
  });
});
