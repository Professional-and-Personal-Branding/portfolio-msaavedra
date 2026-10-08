import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { lazyWithPreload } from './lazy-with-preload';

const Panel = () => <p>panel</p>;

const renderInSuspense = (Component: ReturnType<typeof lazyWithPreload>) =>
  render(
    <Suspense fallback={<p>cargando</p>}>
      <Component />
    </Suspense>,
  );

describe('lazyWithPreload', () => {
  it('sin precarga se comporta como React.lazy: muestra el fallback y luego el componente', async () => {
    const Lazy = lazyWithPreload(() => Promise.resolve({ default: Panel }));

    renderInSuspense(Lazy);

    expect(screen.getByText('cargando')).toBeInTheDocument();
    expect(await screen.findByText('panel')).toBeInTheDocument();
  });

  it('tras preload() renderiza en el primer commit, sin pasar por el fallback', async () => {
    const Lazy = lazyWithPreload(() => Promise.resolve({ default: Panel }));

    await Lazy.preload();
    renderInSuspense(Lazy);

    expect(screen.getByText('panel')).toBeInTheDocument();
    expect(screen.queryByText('cargando')).not.toBeInTheDocument();
  });
});
