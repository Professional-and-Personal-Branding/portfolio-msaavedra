import { describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '@/themes/theme-provider';
import { Contact } from './Contact';

function renderContact(variant: 'default' | 'compact') {
  return renderWithProviders(
    <ThemeProvider>
      <Contact data={makeCuratedProfile()} variant={variant} />
    </ThemeProvider>,
  );
}

// improve-a11y-and-performance (D6): un `dl` solo admite grupos `div > dt + dd`.
describe('Contact — lista de definición válida', () => {
  for (const variant of ['default', 'compact'] as const) {
    it(`variante ${variant}: cada hijo del dl es un div con dt y dd directos`, () => {
      const { container } = renderContact(variant);
      const lists = container.querySelectorAll('dl');
      expect(lists.length).toBeGreaterThan(0);
      for (const dl of lists) {
        expect(dl.children.length).toBeGreaterThan(0);
        for (const group of dl.children) {
          expect(group.tagName).toBe('DIV');
          const tags = [...group.children].map((child) => child.tagName);
          expect(tags).toEqual(['DT', 'DD']);
        }
      }
    });
  }

  it('el título de la variante compacta queda fuera del dl', () => {
    const { container } = renderContact('compact');
    const title = [...container.querySelectorAll('p')].find((p) => p.textContent === 'Hablemos');
    expect(title).toBeDefined();
    expect(title?.closest('dl')).toBeNull();
  });
});
