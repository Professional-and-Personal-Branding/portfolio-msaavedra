import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '@/themes/theme-provider';
import { Certifications } from './Certifications';

// add-certification-verification (D5, D6): «Ver credencial», ID y vigencia en la sección pública.
const BASE = makeCuratedProfile().certifications[0]!;
const VALID = {
  ...BASE,
  id: 'c-valid',
  name: 'Arquitecto de Soluciones en la Nube',
  verificationUrl: 'https://example.org/credenciales/arquitecto-nube-2023',
  credentialId: 'EJ-2023-0042',
  expiresAt: '2029-06',
};
const EXPIRED = {
  ...BASE,
  id: 'c-expired',
  name: 'Liderazgo técnico',
  year: null,
  verificationUrl: null,
  credentialId: null,
  expiresAt: '2025-12',
};
const SECOND = {
  ...BASE,
  id: 'c-second',
  name: 'Seguridad en la nube',
  verificationUrl: 'https://example.org/credenciales/seguridad',
  credentialId: null,
  expiresAt: null,
};

function renderSection(certifications: (typeof BASE)[], route = '/') {
  return renderWithProviders(
    <ThemeProvider>
      <Certifications data={makeCuratedProfile({ certifications })} />
    </ThemeProvider>,
    { route },
  );
}

describe('Certifications — credencial verificable', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T12:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('el enlace lleva la URL, se abre en una pestaña nueva y no filtra el opener', () => {
    renderSection([VALID]);
    const link = screen.getByRole('link', { name: /Ver credencial/ });
    expect(link).toHaveAttribute('href', VALID.verificationUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('dos credenciales tienen nombres accesibles distintos', () => {
    renderSection([VALID, SECOND]);
    const names = screen.getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual([
      'Ver credencial: Arquitecto de Soluciones en la Nube',
      'Ver credencial: Seguridad en la nube',
    ]);
    expect(
      screen.getByRole('link', { name: 'Ver credencial: Seguridad en la nube' }),
    ).toBeInTheDocument();
  });

  it('muestra el ID y «Válida hasta» con el mes de vencimiento', () => {
    renderSection([VALID]);
    expect(screen.getByText(/ID: EJ-2023-0042/)).toBeInTheDocument();
    expect(screen.getByText(/Válida hasta jun 2029/)).toBeInTheDocument();
    expect(screen.queryByText('Vencida')).toBeNull();
  });

  it('con solo el año, «Válida hasta» muestra el año', () => {
    renderSection([{ ...VALID, expiresAt: '2030' }]);
    expect(screen.getByText(/Válida hasta 2030/)).toBeInTheDocument();
  });

  it('una vencida muestra «Vencida» y, sin enlace, no tiene link', () => {
    renderSection([EXPIRED]);
    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/Válida hasta/)).toBeNull();
  });

  it('en inglés usa «View credential», «Valid until» y «Expired» con la misma URL', () => {
    renderSection([VALID, EXPIRED], '/?lang=en');
    const link = screen.getByRole('link', { name: /View credential/ });
    expect(link).toHaveAttribute('href', VALID.verificationUrl);
    expect(screen.getByText(/Valid until Jun 2029/)).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('una tarjeta sin datos nuevos queda como antes: sin enlace ni línea de detalle', () => {
    const plain = { ...BASE, verificationUrl: null, credentialId: null, expiresAt: null };
    const { container } = renderSection([plain]);
    expect(screen.queryByRole('link')).toBeNull();
    const card = container.querySelector('li');
    expect(card).not.toBeNull();
    const paragraphs = within(card as HTMLElement)
      .getAllByText(/./)
      .filter((el) => el.tagName === 'P');
    expect(paragraphs).toHaveLength(2);
  });
});
